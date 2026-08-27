/**
 * Payload CMS API utility for fetching data
 * Server-side only - uses direct Payload access
 * Uses unstable_cache for cross-request caching with tag-based invalidation
 *
 * Error handling contract: these fetchers RETHROW on a fetch failure rather
 * than returning an empty default. A thrown error is never persisted to the
 * ISR/full-route cache, so a transient blip (e.g. a cold-start connection storm
 * right after a Vercel deploy) self-heals on the next request. Swallowing the
 * error into `[]`/`null` would bake an empty render into the route cache and
 * serve it for the whole revalidate window (see the /m fix, commit 7160f57e).
 * A genuinely-empty result (e.g. location not found) is still returned normally
 * from inside the cached fn and remains cacheable. The one exception is
 * hasAnyBeerJustReleased: it feeds a non-critical badge that is discarded after
 * the first /m poll, so it degrades to `false` rather than blanking the display.
 */

import { cache } from 'react'
import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { unstable_cache } from 'next/cache'
import {
  getRecurringFoodState,
  recurringDays,
  recurringOccurrences,
  type RecurringFoodState,
} from '@/src/utils/recurring-food'
import { getPublicBeerReviews } from '@/src/utils/beer-reviews'
import type {
  Beer as PayloadBeer,
  Menu,
  HolidayHour,
  Event as PayloadEvent,
  Food as PayloadFood,
  Faq,
} from '@/src/payload-types'

export type PayloadMenu = Menu
import type { LocationSlug } from '@/lib/types/location'
import { BreweryEvent, EventType, EventStatus } from '@/lib/types/event'
import { logger } from '@/lib/utils/logger'
import { CACHE_TAGS } from '@/lib/utils/cache'
import { extractBeerFromMenuItem } from './menu-item-utils'
import { getMediaUrl } from './media-utils'
import { getTodayEST, getTodayMidnightISO } from './date'
import { formatAddress } from './formatters'

/**
 * Check if any beer globally has justReleased flag set
 * Used to determine "Just Released" display logic
 * Cached until 'beers' tag is invalidated
 */
export const hasAnyBeerJustReleased = async (): Promise<boolean> => {
  try {
    return await unstable_cache(
      async (): Promise<boolean> => {
        const payload = await getPayload({ config })

        const result = await payload.find({
          collection: 'beers',
          limit: 1,
          where: {
            justReleased: {
              equals: true,
            },
          },
        })

        return result.docs.length > 0
      },
      ['any-beer-just-released'],
      { tags: [CACHE_TAGS.beers], revalidate: 300 },
    )()
  } catch (error) {
    logger.error('Error checking justReleased beers', error)
    // Non-critical badge flag (drives the "Just Released" highlight and is
    // discarded after the first /m poll). Degrade gracefully instead of
    // throwing — a transient blip here must not black out an unattended
    // /m display via the auto-reloading error boundary.
    return false
  }
}

/**
 * Get all beers from Payload
 * Cached until 'beers' tag is invalidated
 */
export const getAllBeersFromPayload = async (): Promise<PayloadBeer[]> => {
  try {
    return await unstable_cache(
      async (): Promise<PayloadBeer[]> => {
        const payload = await getPayload({ config })

        const result = await payload.find({
          collection: 'beers',
          limit: 1000,
          where: {
            hideFromSite: {
              not_equals: true,
            },
          },
          depth: 2, // Include style and image relations
        })

        return result.docs
      },
      ['all-beers'],
      { tags: [CACHE_TAGS.beers], revalidate: 3600 }, // 1 hour fallback
    )()
  } catch (error) {
    logger.error('Error fetching beers from Payload', error)
    throw error
  }
}

/**
 * Get beer by slug from Payload
 * Cached until 'beers' tag is invalidated
 *
 * Also wrapped in React cache() for per-request dedupe: generateMetadata and
 * the page component both call this, and unstable_cache alone runs the Mongo
 * find twice on concurrent cold misses (Next 15.5). cache() collapses the two
 * calls of one request into a single lookup.
 */
export const getBeerBySlug = cache(async (slug: string): Promise<PayloadBeer | null> => {
  return unstable_cache(
    async (): Promise<PayloadBeer | null> => {
      const payload = await getPayload({ config })

      const result = await payload.find({
        collection: 'beers',
        where: {
          slug: {
            equals: slug,
          },
        },
        limit: 1,
        depth: 2,
      })

      // Return null for "not found" (cacheable), but let errors throw (not cached)
      const beer = result.docs[0]
      if (!beer) return null

      const reviews = await getPublicBeerReviews(payload, beer.id)
      if (reviews === null) return beer
      return { ...beer, positiveReviews: reviews }
    },
    [`beer-${slug}`],
    { tags: [CACHE_TAGS.beers], revalidate: 3600 },
  )()
})

/**
 * Get menus for a specific location
 * Cached until 'menus' or 'locations' tags are invalidated
 */
export const getMenusByLocation = async (locationSlug: string): Promise<PayloadMenu[]> => {
  try {
    return await unstable_cache(
      async (): Promise<PayloadMenu[]> => {
        const payload = await getPayload({ config })

        // First get the location by slug
        const locationResult = await payload.find({
          collection: 'locations',
          where: {
            slug: {
              equals: locationSlug,
            },
          },
          limit: 1,
        })

        if (locationResult.docs.length === 0) {
          // Location not found is a valid cacheable result (not an error)
          return []
        }

        const locationId = locationResult.docs[0].id

        // Then get menus for that location
        const menusResult = await payload.find({
          collection: 'menus',
          where: {
            and: [
              {
                location: {
                  equals: locationId,
                },
              },
              {
                _status: {
                  equals: 'published',
                },
              },
            ],
          },
          depth: 3, // Include location, beers, and beer relations (style, image)
          limit: 100,
        })

        return menusResult.docs
      },
      [`menus-location-${locationSlug}`],
      // 'beers' keeps homepage featured menus fresh on beer edits now that the
      // revalidation plugin no longer fires the broad 'menus' tag for beers.
      { tags: [CACHE_TAGS.menus, CACHE_TAGS.locations, CACHE_TAGS.beers], revalidate: 300 }, // 5 min fallback
    )()
  } catch (error) {
    logger.error(`Error fetching menus for location: ${locationSlug}`, error)
    throw error
  }
}

/**
 * Get draft menu for a location
 */
export async function getDraftMenu(locationSlug: string): Promise<PayloadMenu | null> {
  const menus = await getMenusByLocation(locationSlug)
  return menus.find((menu) => menu.type === 'draft') || null
}

/**
 * Get cans menu for a location
 */
export async function getCansMenu(locationSlug: string): Promise<PayloadMenu | null> {
  const menus = await getMenusByLocation(locationSlug)
  const cansMenu = menus.find((menu) => menu.type === 'cans') || null

  // Clone and sort to avoid mutating the cached object from unstable_cache
  if (cansMenu?.items) {
    return {
      ...cansMenu,
      items: [...cansMenu.items].sort((a, b) => {
        const recipeA = extractBeerFromMenuItem(a)?.recipe || 0
        const recipeB = extractBeerFromMenuItem(b)?.recipe || 0
        return recipeB - recipeA
      }),
    }
  }

  return cansMenu
}

/**
 * Field narrowing for the populated relations in menu queries. Menus ship in
 * every 2s poll response and every /m ISR render, so populated Beer/Product/
 * Media docs carry only what the displays render — derived from
 * convertMenuItems (components/home/featured-menu.tsx) and the poll route's
 * updatedAt timestamp check. Notably excluded: positiveReviews (unbounded
 * review array), the untappd/upc admin fields, and the labelBase/
 * labelMetalness/labelTextures generator uploads.
 */
const MENU_POPULATE = {
  beers: {
    slug: true,
    name: true,
    style: true,
    abv: true,
    description: true,
    image: true,
    labelVideo: true,
    glass: true,
    fourPack: true,
    bottlePrice: true,
    recipe: true,
    hops: true,
    draftPrice: true,
    halfPour: true,
    halfPourOnly: true,
    hideFromSite: true,
    justReleased: true,
    collab: true,
    createdAt: true,
    updatedAt: true,
    untappdRating: true,
    topBeerDrops: true,
  },
  products: {
    name: true,
    options: true,
    abv: true,
    description: true,
    price: true,
    guestTap: true,
    collab: true,
    createdAt: true,
    updatedAt: true,
  },
  styles: { name: true },
  // filename/prefix feed the Vercel Blob adapter's computed `url` — without
  // them populated media docs come back with url: null.
  media: { url: true, sizes: true, filename: true, prefix: true },
  // linesLastCleaned drives the "Draft lines cleaned N days ago" line on the
  // /m draft displays (formatLinesCleanedDate in featured-menu.tsx).
  locations: { slug: true, name: true, linesLastCleaned: true },
} as const

/**
 * Shared query body for getMenuByUrl / getMenuByUrlFresh. Throws on transient
 * failures — both callers depend on that (see getMenuByUrlFresh's JSDoc).
 */
async function findMenuByUrl(url: string): Promise<PayloadMenu | null> {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'menus',
    where: {
      and: [
        {
          url: {
            equals: url,
          },
        },
        {
          _status: {
            equals: 'published',
          },
        },
      ],
    },
    overrideAccess: true, // Bypass access control — we filter by _status ourselves
    depth: 3, // Include location, beers, and beer relations (style, image)
    populate: MENU_POPULATE,
    limit: 1,
  })

  return result.docs[0] || null
}

/**
 * Get menu by URL slug (e.g., 'lawrenceville-draft', 'zelienople-cans')
 * Cached until the 'menus' tag or this menu's own `menu-${url}` tag is invalidated
 */
export const getMenuByUrl = async (url: string): Promise<PayloadMenu | null> => {
  try {
    return await unstable_cache(
      () => findMenuByUrl(url),
      [`menu-url-${url}`],
      // menu-${url} lets beer edits invalidate only the menus that contain the
      // beer (see revalidateMenusForBeer in src/collections/Beers.ts) instead
      // of nuking every menu via the broad 'menus' tag.
      { tags: [CACHE_TAGS.menus, `menu-${url}`], revalidate: 60 }, // 1 min fallback for menus
    )()
  } catch (error) {
    logger.error(`Error fetching menu by URL: ${url}`, error)
    throw error
  }
}

/**
 * Get menu by URL slug - UNCACHED version for real-time updates
 * Used by SSE endpoints and menu display pages that need immediate updates
 *
 * Returns null ONLY when the menu genuinely doesn't exist. A fetch failure
 * (cold start, transient DB blip) throws rather than returning null: the
 * display page (m/[menuUrl]) turns null into notFound(), and because that
 * page is ISR (revalidate = 60), a 404 render gets cached and served to every
 * display for up to a minute. A thrown error is never persisted to the route
 * cache, so it self-heals on the next request and hits the segment's
 * auto-reloading error boundary instead of poisoning the fleet with a 404.
 */
export const getMenuByUrlFresh = async (url: string): Promise<PayloadMenu | null> => {
  try {
    return await findMenuByUrl(url)
  } catch (error) {
    // Rethrow: a transient failure must NOT render as notFound() (see JSDoc).
    logger.error(`Error fetching menu by URL (fresh): ${url}`, error)
    throw error
  }
}

/**
 * Get all active locations from Payload
 * Cached until 'locations' tag is invalidated
 *
 * React cache() on top for per-request dedupe: several server components fetch
 * locations concurrently in one render, and unstable_cache does not collapse
 * in-flight calls on a cold miss (same reason as getBeerBySlug above).
 */
export const getAllLocations = cache(async () => {
  try {
    return await unstable_cache(
      async () => {
        const payload = await getPayload({ config })

        const result = await payload.find({
          collection: 'locations',
          where: {
            active: {
              equals: true,
            },
          },
          sort: 'name',
        })

        return result.docs
      },
      ['all-locations'],
      { tags: [CACHE_TAGS.locations], revalidate: 3600 },
    )()
  } catch (error) {
    logger.error('Error fetching locations from Payload', error)
    throw error
  }
})

/**
 * Transform a Payload Event document into a BreweryEvent.
 * Handles polymorphic location field extraction.
 */
export function transformPayloadEventToBreweryEvent(
  event: PayloadEvent,
  fallbackLocationSlug?: string,
  fallbackLocationName?: string,
): BreweryEvent {
  const eventLocation = typeof event.location === 'object' ? event.location : null

  return {
    id: event.id,
    title: event.organizer,
    description: event.description || event.organizer,
    date: event.date.split('T')[0],
    time: event.startTime || '',
    endTime: event.endTime ?? undefined,
    vendor: event.organizer,
    type: EventType.SPECIAL_EVENT,
    status: EventStatus.SCHEDULED,
    location: (eventLocation?.slug || fallbackLocationSlug) as LocationSlug,
    locationName: eventLocation?.name || fallbackLocationName,
    site: event.site ?? undefined,
    attendees: event.attendees ?? undefined,
    tags: event.tags ?? undefined,
  }
}

/**
 * Extract vendor info from a polymorphic vendor field.
 * Handles both object (populated) and string (ID-only) vendor references.
 */
export function extractVendorInfo(
  vendor: unknown,
  fallbackSite?: string | null,
): { name: string; site?: string; logoUrl?: string } {
  if (typeof vendor === 'object' && vendor !== null && 'name' in vendor) {
    const v = vendor as { name: string; site?: string | null; logo?: unknown }
    return {
      name: v.name,
      site: (fallbackSite || v.site) ?? undefined,
      logoUrl: getMediaUrl(v.logo) ?? undefined,
    }
  }
  return {
    name: String(vendor ?? ''),
    site: fallbackSite ?? undefined,
  }
}

// getBeerImageUrl moved to formatters.ts for client-side compatibility

/**
 * Get available beers from all location menus
 * Returns unique beers that appear on any published menu
 * Cached until 'menus' or 'beers' tags are invalidated
 */
export const getAvailableBeersFromMenus = async (): Promise<PayloadBeer[]> => {
  try {
    return await unstable_cache(
      async (): Promise<PayloadBeer[]> => {
        const payload = await getPayload({ config })

        // Get all published menus from all locations
        const menusResult = await payload.find({
          collection: 'menus',
          where: {
            _status: {
              equals: 'published',
            },
          },
          depth: 3, // Include location, beers, and beer relations (style, image)
          limit: 1000,
        })

        // Extract unique beers from all menus
        const beerMap = new Map<string, PayloadBeer>()

        for (const menu of menusResult.docs) {
          if (!menu.items) continue

          for (const item of menu.items) {
            const beer = extractBeerFromMenuItem(item)
            if (!beer) continue

            // Skip beers that are hidden from site
            if (beer.hideFromSite) continue

            // Add to map (using ID as key to deduplicate)
            if (!beerMap.has(beer.id)) {
              beerMap.set(beer.id, beer)
            }
          }
        }

        // Convert to array and sort by recipe (descending - newest first)
        const beers = Array.from(beerMap.values())
        beers.sort((a, b) => (b.recipe || 0) - (a.recipe || 0))

        return beers
      },
      ['available-beers-from-menus'],
      { tags: [CACHE_TAGS.menus, CACHE_TAGS.beers], revalidate: 300 },
    )()
  } catch (error) {
    logger.error('Error fetching available beers from menus', error)
    throw error
  }
}

/**
 * Get Coming Soon beers from Payload global
 * Cached until 'coming-soon' tag is invalidated
 */
export const getComingSoonBeers = async () => {
  try {
    return await unstable_cache(
      async () => {
        const payload = await getPayload({ config })

        const result = await payload.findGlobal({
          slug: 'coming-soon',
          depth: 2, // Include beer and style relations
        })

        return result.beers || []
      },
      ['coming-soon-beers'],
      { tags: [CACHE_TAGS.comingSoon], revalidate: 300 },
    )()
  } catch (error) {
    logger.error('Error fetching coming soon beers', error)
    throw error
  }
}

/**
 * Fetch a global by slug
 * Cached based on the global type
 */
export const fetchGlobal = async (slug: string, depth: number = 0) => {
  const tag = slug === 'coming-soon' ? CACHE_TAGS.comingSoon : CACHE_TAGS.siteContent

  try {
    return await unstable_cache(
      async () => {
        const payload = await getPayload({ config })
        const result = await payload.findGlobal({
          slug: slug as 'coming-soon' | 'site-content',
          depth,
        })
        return result
      },
      [`global-${slug}`],
      { tags: [tag], revalidate: 300 },
    )()
  } catch (error) {
    logger.error(`Error fetching global: ${slug}`, error)
    throw error
  }
}

export type DayOfWeek =
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface WeeklyHoursDay {
  day: DayOfWeek
  date: Date
  open: string | null
  close: string | null
  closed: boolean
  holidayName?: string
  note?: string
  timezone?: string
}

/**
 * Get the current week's hours for a location with holiday overrides applied
 * Returns an array of 7 days starting from Monday of the current week
 * Cached until 'locations' or 'holiday-hours' tags are invalidated
 *
 * React cache() on top for per-request dedupe: the footer and the page body
 * both request hours for the same locations in one render.
 */
export const getWeeklyHoursWithHolidays = cache(
  async (locationId: string): Promise<WeeklyHoursDay[]> => {
    // Calculate week start for cache key
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(now)
    monday.setDate(now.getDate() + mondayOffset)
    monday.setHours(0, 0, 0, 0)
    const weekKey = monday.toISOString().split('T')[0]

    try {
      return await unstable_cache(
        async (): Promise<WeeklyHoursDay[]> => {
          const payload = await getPayload({ config })

          // Get the location
          const locationResult = await payload.find({
            collection: 'locations',
            where: {
              id: {
                equals: locationId,
              },
            },
            limit: 1,
          })

          const location = locationResult.docs[0]
          if (!location) {
            // Location not found is a valid cacheable result
            return []
          }

          // Calculate the start of the current week (Monday)
          const currentNow = new Date()
          const currentDayOfWeek = currentNow.getDay()
          const currentMondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek
          const currentMonday = new Date(currentNow)
          currentMonday.setDate(currentNow.getDate() + currentMondayOffset)
          currentMonday.setHours(0, 0, 0, 0)

          // Calculate the end of the week (Sunday)
          const sunday = new Date(currentMonday)
          sunday.setDate(currentMonday.getDate() + 6)

          // Format dates for query
          const startDateStr = currentMonday.toISOString().split('T')[0]
          const endDateStr = sunday.toISOString().split('T')[0]

          // Get all holiday hours for this location within this week
          const holidayResult = await payload.find({
            collection: 'holiday-hours',
            where: {
              and: [
                {
                  locations: {
                    contains: locationId,
                  },
                },
                {
                  date: {
                    greater_than_equal: startDateStr,
                  },
                },
                {
                  date: {
                    less_than_equal: endDateStr,
                  },
                },
              ],
            },
            limit: 7,
            depth: 0,
          })

          // Create a map of holiday overrides by date string
          const holidayMap = new Map<string, HolidayHour>()
          for (const holiday of holidayResult.docs) {
            const holidayDateStr = holiday.date.split('T')[0]
            holidayMap.set(holidayDateStr, holiday)
          }

          // Build the weekly hours array
          const days: DayOfWeek[] = [
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
            'sunday',
          ]
          const weeklyHours: WeeklyHoursDay[] = []

          for (let i = 0; i < 7; i++) {
            const date = new Date(currentMonday)
            date.setDate(currentMonday.getDate() + i)
            const dateStr = date.toISOString().split('T')[0]
            const dayName = days[i]

            // Check if there's a holiday override for this day
            const holiday = holidayMap.get(dateStr)
            const timezone = location.timezone || 'America/New_York'

            if (holiday) {
              // Use holiday hours
              if (holiday.type === 'closed') {
                weeklyHours.push({
                  day: dayName,
                  date,
                  open: null,
                  close: null,
                  closed: true,
                  holidayName: holiday.name,
                  note: holiday.note || undefined,
                  timezone,
                })
              } else {
                // Modified hours
                weeklyHours.push({
                  day: dayName,
                  date,
                  open: holiday.hours?.open || null,
                  close: holiday.hours?.close || null,
                  closed: false,
                  holidayName: holiday.name,
                  note: holiday.note || undefined,
                  timezone,
                })
              }
            } else {
              // Use regular hours from location
              const regularHours = location[dayName] as
                { open?: string | null; close?: string | null } | undefined
              const hasHours = regularHours?.open && regularHours?.close

              weeklyHours.push({
                day: dayName,
                date,
                open: regularHours?.open || null,
                close: regularHours?.close || null,
                closed: !hasHours,
                timezone,
              })
            }
          }

          return weeklyHours
        },
        [`weekly-hours-${locationId}-${weekKey}`],
        { tags: [CACHE_TAGS.locations, CACHE_TAGS.holidayHours], revalidate: 300 },
      )()
    } catch (error) {
      logger.error(`Error fetching weekly hours with holidays for location ${locationId}`, error)
      throw error
    }
  },
)

/**
 * Get upcoming events for a location from Payload
 * Returns events with date >= today, sorted by date ascending
 * Cached until 'events' tag is invalidated
 */
export const getUpcomingEventsFromPayload = async (
  locationSlug: string,
  limit: number = 10,
): Promise<PayloadEvent[]> => {
  const todayKey = getTodayEST()

  try {
    return await unstable_cache(
      async (): Promise<PayloadEvent[]> => {
        const payload = await getPayload({ config })

        // Get location ID from slug
        const locationResult = await payload.find({
          collection: 'locations',
          where: {
            slug: { equals: locationSlug },
          },
          limit: 1,
        })

        if (locationResult.docs.length === 0) {
          // Location not found is a valid cacheable result
          return []
        }

        const locationId = locationResult.docs[0].id

        const todayStr = getTodayMidnightISO()

        const result = await payload.find({
          collection: 'events',
          where: {
            and: [
              {
                location: { equals: locationId },
              },
              {
                date: { greater_than_equal: todayStr },
              },
              {
                visibility: { equals: 'public' },
              },
            ],
          },
          sort: 'date',
          limit,
          depth: 1,
        })

        return result.docs
      },
      [`events-${locationSlug}-${limit}-${todayKey}`],
      { tags: [CACHE_TAGS.events, CACHE_TAGS.locations], revalidate: 300 },
    )()
  } catch (error) {
    logger.error(`Error fetching events for location: ${locationSlug}`, error)
    throw error
  }
}

/**
 * Get upcoming food vendors for a location from Payload
 * Returns food entries with date >= today, sorted by date ascending
 * Cached until 'food' tag is invalidated
 */
export const getUpcomingFoodFromPayload = async (
  locationSlug: string,
  limit: number = 10,
): Promise<PayloadFood[]> => {
  const todayKey = getTodayEST()

  try {
    return await unstable_cache(
      async (): Promise<PayloadFood[]> => {
        const payload = await getPayload({ config })

        // Get location ID from slug
        const locationResult = await payload.find({
          collection: 'locations',
          where: {
            slug: { equals: locationSlug },
          },
          limit: 1,
        })

        if (locationResult.docs.length === 0) {
          // Location not found is a valid cacheable result
          return []
        }

        const locationId = locationResult.docs[0].id

        const todayStr = getTodayMidnightISO()

        const result = await payload.find({
          collection: 'food',
          where: {
            and: [
              {
                location: { equals: locationId },
              },
              {
                date: { greater_than_equal: todayStr },
              },
            ],
          },
          sort: 'date',
          limit,
          depth: 2,
        })

        return result.docs
      },
      [`food-${locationSlug}-${limit}-${todayKey}`],
      { tags: [CACHE_TAGS.food, CACHE_TAGS.locations], revalidate: 300 },
    )()
  } catch (error) {
    logger.error(`Error fetching food for location: ${locationSlug}`, error)
    throw error
  }
}

// ============ RECURRING FOOD ============

/**
 * Calculate upcoming occurrences of a specific week/day combo
 * e.g., "2nd Tuesday" -> next N dates that are the 2nd Tuesday of their month
 */
function getUpcomingDatesForSlot(
  dayIndex: number,
  weekOccurrence: number,
  monthsAhead: number = 6,
): Date[] {
  const dates: Date[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startMonth = today.getMonth()
  const startYear = today.getFullYear()

  for (let i = 0; i < monthsAhead; i++) {
    const month = (startMonth + i) % 12
    const year = startYear + Math.floor((startMonth + i) / 12)

    const firstOfMonth = new Date(year, month, 1)
    const firstDayOfMonth = firstOfMonth.getDay()

    let firstOccurrence = dayIndex - firstDayOfMonth + 1
    if (firstOccurrence <= 0) firstOccurrence += 7

    const targetDay = firstOccurrence + (weekOccurrence - 1) * 7
    const targetDate = new Date(year, month, targetDay)

    if (targetDate.getMonth() === month && targetDate >= today) {
      dates.push(targetDate)
    }
  }

  return dates
}

/**
 * Get the recurring food configuration for public expansion.
 *
 * Reads through getRecurringFoodState, which returns the normalized
 * recurring-food-schedules/-exclusions collections once the global's
 * `normalizedAt` marker is set and the frozen legacy global before that. The
 * admin grid writes through the same helper, so grid edits reach /food, the
 * homepage, and the location event pages alike.
 *
 * Cached until the 'food' tag is invalidated (both normalized collections map
 * to that tag in the revalidation plugin).
 */
const getRecurringFoodGlobal = async (): Promise<RecurringFoodState> => {
  try {
    return await unstable_cache(
      async (): Promise<RecurringFoodState> => {
        const payload = await getPayload({ config })
        return getRecurringFoodState(payload, { overrideAccess: true })
      },
      ['recurring-food-global'],
      { tags: [CACHE_TAGS.food], revalidate: 300 },
    )()
  } catch (error) {
    logger.error('Error fetching recurring food schedules', error)
    throw error
  }
}

export interface RecurringFoodEntry {
  id: string
  vendor: {
    id: string
    name: string
    site?: string | null
    logo?: string | { url?: string } | null
  }
  date: string
  time?: string
  location: string
  isRecurring: true
  dayOfWeek: string
  weekOfMonth: string
}

/**
 * Get upcoming recurring food vendors for a location
 * Expands recurring schedules into specific dates
 * Cached until 'food' tag is invalidated
 */
const getUpcomingRecurringFood = async (
  locationSlug: string,
  limit: number = 10,
  monthsAhead: number = 3,
): Promise<RecurringFoodEntry[]> => {
  const todayKey = getTodayEST()

  try {
    return await unstable_cache(
      async (): Promise<RecurringFoodEntry[]> => {
        const payload = await getPayload({ config })

        // Get location ID from slug
        const locationResult = await payload.find({
          collection: 'locations',
          where: { slug: { equals: locationSlug } },
          limit: 1,
        })

        if (locationResult.docs.length === 0) {
          // Location not found is a valid cacheable result
          return []
        }

        const location = locationResult.docs[0]
        const locationId = location.id

        // Get recurring food global
        const recurringFood = await getRecurringFoodGlobal()
        const locationSchedule = recurringFood.schedules[locationId] || {}
        const locationExclusions = recurringFood.exclusions[locationId] || []

        // Collect all vendor IDs to fetch in batch
        const vendorIds = new Set<string>()
        for (const day of recurringDays) {
          for (const week of recurringOccurrences) {
            const vendorId = locationSchedule[day]?.[week]
            if (vendorId) vendorIds.add(vendorId)
          }
        }

        // Fetch all vendors in one request
        const vendorMap: Record<
          string,
          {
            id: string
            name: string
            site?: string | null
            logo?: string | { url?: string } | null
          }
        > = {}
        if (vendorIds.size > 0) {
          const vendorResult = await payload.find({
            collection: 'food-vendors',
            where: {
              id: { in: Array.from(vendorIds) },
            },
            limit: vendorIds.size,
            depth: 2,
          })
          for (const vendor of vendorResult.docs) {
            vendorMap[vendor.id] = {
              id: vendor.id,
              name: vendor.name,
              site: vendor.site,
              logo: vendor.logo as string | { url?: string } | null | undefined,
            }
          }
        }

        // Generate upcoming dates for each scheduled slot
        const entries: RecurringFoodEntry[] = []

        for (const [dayIndex, day] of recurringDays.entries()) {
          for (const [weekIndex, week] of recurringOccurrences.entries()) {
            const vendorId = locationSchedule[day]?.[week]
            const vendor = vendorId ? vendorMap[vendorId] : undefined
            if (!vendor) continue

            for (const date of getUpcomingDatesForSlot(dayIndex, weekIndex + 1, monthsAhead)) {
              const dateKey = date.toISOString().split('T')[0]
              if (locationExclusions.includes(dateKey)) continue

              entries.push({
                id: `recurring-${locationId}-${day}-${week}-${dateKey}`,
                vendor,
                date: dateKey,
                location: locationId,
                isRecurring: true,
                dayOfWeek: day,
                weekOfMonth: week,
              })
            }
          }
        }

        // Sort by date and limit
        entries.sort((a, b) => a.date.localeCompare(b.date))
        return entries.slice(0, limit)
      },
      [`recurring-food-${locationSlug}-${limit}-${monthsAhead}-${todayKey}`],
      { tags: [CACHE_TAGS.food, CACHE_TAGS.locations], revalidate: 300 },
    )()
  } catch (error) {
    logger.error(`Error fetching recurring food for location: ${locationSlug}`, error)
    throw error
  }
}

/**
 * Get combined food (individual + recurring) for a location
 * Merges and deduplicates by date
 */
export const getCombinedUpcomingFood = async (
  locationSlug: string,
  limit: number = 10,
): Promise<(PayloadFood | RecurringFoodEntry)[]> => {
  const [individual, recurring] = await Promise.all([
    getUpcomingFoodFromPayload(locationSlug, limit),
    getUpcomingRecurringFood(locationSlug, limit),
  ])

  // Build a set of date+vendor keys from individual entries so we only suppress
  // a recurring entry when the same vendor already has an individual entry that day.
  // This allows two different vendors on the same date (e.g. GS Sando + Cookey).
  const individualDateVendors = new Set(
    individual.map((f) => {
      const date = typeof f.date === 'string' ? f.date.split('T')[0] : ''
      const vendorId = typeof f.vendor === 'object' ? f.vendor?.id || '' : f.vendor || ''
      return `${date}::${vendorId}`
    }),
  )

  // Filter out recurring entries only when the same vendor has an individual entry on that date
  const filteredRecurring = recurring.filter(
    (r) => !individualDateVendors.has(`${r.date}::${r.vendor.id}`),
  )

  // Combine and sort
  const combined = [...individual, ...filteredRecurring]
  combined.sort((a, b) => {
    const dateA =
      'isRecurring' in a ? a.date : typeof a.date === 'string' ? a.date.split('T')[0] : ''
    const dateB =
      'isRecurring' in b ? b.date : typeof b.date === 'string' ? b.date.split('T')[0] : ''
    return dateA.localeCompare(dateB)
  })

  return combined.slice(0, limit)
}

// ============ DISTRIBUTOR DATA ============

/**
 * GeoJSON types for distributor map data
 */
export interface DistributorGeoFeature {
  type: 'Feature'
  geometry: {
    type: 'Point'
    coordinates: [number, number] // [longitude, latitude]
  }
  properties: {
    id: number
    Name: string
    address: string
    customerType: string
    uniqueId: string
  }
}

export interface DistributorGeoJSON {
  type: 'FeatureCollection'
  features: DistributorGeoFeature[]
}

/**
 * Get all active distributors as GeoJSON
 * Cached for 1 hour (distributors don't change frequently)
 */
export const getAllDistributorsGeoJSON = async (): Promise<DistributorGeoJSON> => {
  try {
    return await unstable_cache(
      async (): Promise<DistributorGeoJSON> => {
        const payload = await getPayload({ config })

        const result = await payload.find({
          collection: 'distributors',
          limit: 2000,
          where: {
            active: {
              equals: true,
            },
          },
          depth: 0,
        })

        const features: DistributorGeoFeature[] = result.docs
          .filter((dist) => {
            // Filter out distributors without valid coordinates
            if (!dist.location) return false
            if (Array.isArray(dist.location) && dist.location.length === 2) return true
            return false
          })
          .map((dist, index) => ({
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: dist.location as [number, number],
            },
            properties: {
              id: index,
              Name: dist.name,
              address: formatAddress(dist),
              customerType: dist.customerType || 'Retail',
              uniqueId: dist.id,
            },
          }))

        return {
          type: 'FeatureCollection',
          features,
        }
      },
      ['all-distributors-geojson'],
      { tags: [CACHE_TAGS.distributors], revalidate: 3600 },
    )()
  } catch (error) {
    logger.error('Error fetching distributors from Payload', error)
    throw error
  }
}

// ============ FAQ DATA ============

/**
 * Get all active FAQs from Payload, sorted by order
 * Cached until 'faqs' tag is invalidated
 */
export const getActiveFAQs = async (): Promise<Faq[]> => {
  try {
    return await unstable_cache(
      async (): Promise<Faq[]> => {
        const payload = await getPayload({ config })

        const result = await payload.find({
          collection: 'faqs',
          where: {
            active: {
              equals: true,
            },
          },
          sort: 'order',
          limit: 100,
        })

        return result.docs
      },
      ['active-faqs'],
      { tags: [CACHE_TAGS.faqs], revalidate: 3600 },
    )()
  } catch (error) {
    logger.error('Error fetching FAQs from Payload', error)
    throw error
  }
}
