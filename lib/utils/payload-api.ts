/**
 * Payload CMS API utility for fetching data
 * Server-side only - uses direct Payload access
 * Uses unstable_cache for cross-request caching with tag-based invalidation
 *
 * Error handling contract: these fetchers RETHROW on a fetch failure rather
 * than returning an empty default. A thrown error is never stored in the data
 * cache (`unstable_cache`) or in a cached page, so a transient blip (e.g. a
 * cold-start connection storm right after a Vercel deploy) self-heals on the
 * next request. Swallowing the error into `[]`/`null` would cache the empty
 * result and serve it until the next revalidation (this once blanked the /m
 * displays; commit 7160f57e).
 * A genuinely-empty result (e.g. location not found) is still returned normally
 * from inside the cached fn and remains cacheable.
 *
 * Identity contract: every read here acts as an anonymous visitor and passes
 * `overrideAccess: false` explicitly (see AGENTS.md, Access control), so
 * collection and field access rules decide what the public sees — e.g. event
 * contact fields and food-vendor email/phone are stripped, and beers are
 * limited to published ones (see `canReadBeers` in src/collections/Beers.ts).
 */

import { cache } from 'react'
import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { unstable_cache } from 'next/cache'
import {
  getRecurringFoodState,
  recurringDays,
  recurringOccurrences,
  scheduleYearFilter,
  type RecurringFoodState,
} from '@/src/utils/recurring-food'
import { getPublicBeerReviews } from '@/src/utils/beer-reviews'
import { relationshipId } from '@/src/utils/relationship-id'
import type {
  Beer as PayloadBeer,
  Menu,
  HolidayHour,
  Event as PayloadEvent,
  RecurringEvent,
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
import { getUpcomingDatesForSlot, toDateKey } from './food-dates'
import { formatAddress } from './formatters'
import { expandRecurringEvents, mergeScheduledEvents } from '@/src/utils/recurring-events'

/**
 * Resolve a location slug to its document.
 *
 * Shared by the per-location fetchers below: they all start by turning a slug
 * into a location id, and all treat "not found" as a valid (cacheable) empty
 * result rather than an error. Returns `undefined` when no location matches.
 */
const findLocationBySlug = async (
  payload: Awaited<ReturnType<typeof getPayload>>,
  locationSlug: string,
  depth?: number,
) => {
  const result = await payload.find({
    collection: 'locations',
    overrideAccess: false,
    where: { slug: { equals: locationSlug } },
    limit: 1,
    depth,
  })
  return result.docs[0]
}

/**
 * Catalog / sitemap / RSS / llms.txt beer fields. Next.js `unstable_cache`
 * refuses entries over 2MB (throws in dev); a full `depth: 2` beers find
 * — reviews join, `positiveReviews` JSON, 3D label uploads — crossed that
 * on `/beer`. Inclusion `select` drops those; `joins: false` skips the
 * `reviews` join. Matches what `convertPayloadBeer` and the feeds read.
 */
export const BEERS_LIST_SELECT = {
  slug: true,
  name: true,
  style: true,
  tag: true,
  abv: true,
  glass: true,
  description: true,
  upc: true,
  image: true,
  untappd: true,
  untappdRating: true,
  untappdRatingCount: true,
  recipe: true,
  hops: true,
  collab: true,
  collabBrewery: true,
  topBeerDrops: true,
  draftPrice: true,
  halfPour: true,
  halfPourOnly: true,
  canSingle: true,
  fourPack: true,
  hideFromSite: true,
  seo: { noIndex: true, canonicalPath: true }, // sitemap only; skips populating seo.ogImage
  createdAt: true,
  updatedAt: true,
} as const satisfies { [K in keyof PayloadBeer]?: true | { [key: string]: true } }

const BEERS_LIST_POPULATE = {
  styles: { name: true },
  tags: { name: true },
  media: { url: true, sizes: true, filename: true, prefix: true },
} as const

/** Catalog/sitemap/RSS beer: `BEERS_LIST_SELECT` plus Payload `id`. */
export type CatalogBeer = Pick<PayloadBeer, 'id' | keyof typeof BEERS_LIST_SELECT>

/**
 * Get all beers from Payload
 * Cached until 'beers' tag is invalidated
 */
export const getAllBeersFromPayload = async (): Promise<CatalogBeer[]> => {
  try {
    return await unstable_cache(
      async (): Promise<CatalogBeer[]> => {
        const payload = await getPayload({ config })

        const result = await payload.find({
          collection: 'beers',
          overrideAccess: false,
          limit: 1000,
          where: {
            hideFromSite: {
              not_equals: true,
            },
          },
          depth: 1,
          select: BEERS_LIST_SELECT,
          populate: BEERS_LIST_POPULATE,
          joins: false,
        })

        return result.docs as CatalogBeer[]
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
        // Reviews are loaded via getPublicBeerReviews below; the join would
        // duplicate them in the unstable_cache entry.
        joins: false,
        overrideAccess: false,
      })

      // Return null for "not found" (cacheable), but let errors throw (not cached).
      // Access hides draft beers from anonymous reads, so a draft slug lands
      // here and the page renders its not-found route.
      const beer = result.docs[0]
      if (!beer) return null

      // The page renders reviews from `positiveReviews`; fill it from the
      // approved beer-reviews docs only (the legacy JSON field is manager-only).
      const reviews = await getPublicBeerReviews(payload, beer.id)
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
        const location = await findLocationBySlug(payload, locationSlug)

        if (!location) {
          // Location not found is a valid cacheable result (not an error)
          return []
        }

        const locationId = location.id

        // Then get menus for that location
        const menusResult = await payload.find({
          collection: 'menus',
          overrideAccess: false,
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
          populate: CATALOG_MENU_POPULATE,
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

type WebsiteMenuType = 'draft' | 'cans'

/**
 * Location lookup for the website menu selections. Depth 0: only the selected
 * menu ids are needed, not the populated menus. React `cache()` lets the draft
 * and cans getters of one render share it, which unstable_cache alone would run
 * twice on concurrent cold misses.
 */
const findLocationForMenus = cache(async (locationSlug: string) => {
  const payload = await getPayload({ config })
  return findLocationBySlug(payload, locationSlug, 0)
})

/**
 * Resolve the explicit website menu selection, never the first menu of a type.
 * One cache entry per type, so a caller that wants one menu (e/[location] wants
 * cans) never fetches or stores the other.
 */
async function getLocationMenu(
  locationSlug: string,
  type: WebsiteMenuType,
): Promise<PayloadMenu | null> {
  return unstable_cache(
    async () => {
      const location = await findLocationForMenus(locationSlug)
      const selected = location?.[`${type}Menu`]
      if (!location || !selected) return null

      const payload = await getPayload({ config })
      const result = await payload.find({
        collection: 'menus',
        overrideAccess: false,
        where: {
          id: { equals: relationshipId(selected) },
          location: { equals: location.id },
          type: { equals: type },
          _status: { equals: 'published' },
        },
        depth: 3,
        populate: CATALOG_MENU_POPULATE,
        limit: 1,
      })
      return result.docs[0] ?? null
    },
    [`location-${locationSlug}-${type}-menu`],
    { tags: [CACHE_TAGS.locations, CACHE_TAGS.menus, CACHE_TAGS.beers], revalidate: 300 },
  )()
}

/** Get the location's selected draft menu for the homepage and taproom page. */
export async function getDraftMenu(locationSlug: string): Promise<PayloadMenu | null> {
  return getLocationMenu(locationSlug, 'draft')
}

/** Get the location's selected cans menu for the homepage and taproom page. */
export async function getCansMenu(locationSlug: string): Promise<PayloadMenu | null> {
  const cansMenu = await getLocationMenu(locationSlug, 'cans')

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
 * every /m page render and in the /api/menu-stream response the displays poll
 * (10s after a change, 30s when idle), so populated Beer/Product/Media docs
 * carry only what the displays render — derived from convertMenuItems
 * (components/home/featured-menu.tsx) and the poll route's updatedAt timestamp
 * check. Notably excluded: positiveReviews (unbounded review array), the
 * untappd/upc admin fields, and the labelBase/labelMetalness/labelTextures
 * generator uploads.
 */
const MENU_BEERS_POPULATE = {
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
  collab: true,
  collabBrewery: true,
  createdAt: true,
  updatedAt: true,
  untappdRating: true,
  topBeerDrops: true,
} as const satisfies { [K in keyof PayloadBeer]?: true | { [key: string]: true } }

const MENU_POPULATE = {
  beers: MENU_BEERS_POPULATE,
  products: {
    name: true,
    category: true,
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
  locations: { slug: true, name: true, linesLastCleaned: true, updatedAt: true },
} as const

/** Landing/catalog menus need `convertPayloadBeer` fields `/m` can skip. */
const CATALOG_MENU_POPULATE = {
  ...MENU_POPULATE,
  beers: {
    ...MENU_BEERS_POPULATE,
    canSingle: true,
    tag: true,
    upc: true,
    untappd: true,
  },
} as const

/**
 * Shared query body for getMenuByUrl / getMenuByUrlFresh. Throws on transient
 * failures — both callers depend on that (see getMenuByUrlFresh's JSDoc).
 */
async function findMenuByUrl(url: string): Promise<PayloadMenu | null> {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'menus',
    // Anonymous read: menus access already limits visitors to published menus;
    // the _status filter below keeps that explicit in the query.
    overrideAccess: false,
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
    depth: 3, // Include location, beers, and beer relations (style, image)
    populate: MENU_POPULATE,
    limit: 1,
  })

  return result.docs[0] || null
}

/**
 * Get menu by URL slug (e.g., 'lawrenceville-draft', 'zelienople-cans')
 * Cached until the 'menus' tag, this menu's own `menu-${url}` tag, or the
 * kiosk-only 'kiosk-menus' tag is invalidated. Only the cached
 * /api/menu-stream/[url] route reads this.
 */
export const getMenuByUrl = async (url: string): Promise<PayloadMenu | null> => {
  try {
    return await unstable_cache(
      () => findMenuByUrl(url),
      [`menu-url-${url}`],
      // menu-${url} lets beer edits invalidate only the menus that contain the
      // beer (see revalidateMenusForBeer in src/collections/Beers.ts) instead
      // of nuking every menu via the broad 'menus' tag. CACHE_TAGS.kioskMenus
      // explains 'kiosk-menus'. Edits reach this cache through those tags, so
      // the time-based fallback can be long.
      {
        tags: [CACHE_TAGS.menus, CACHE_TAGS.kioskMenus, `menu-${url}`],
        revalidate: 3600, // 1 hour fallback
      },
    )()
  } catch (error) {
    logger.error(`Error fetching menu by URL: ${url}`, error)
    throw error
  }
}

/**
 * Get menu by URL slug - UNCACHED version for the /m display page
 * (m/[menuUrl]), which renders per request so each display load starts from
 * the current menu. Also read by /api/menu-stream/[url]/fresh, the endpoint
 * displays fetch when an Ably push says the menu changed (the tagged cache can
 * still hold the previous menu then). Ordinary display polls hit
 * /api/menu-stream, which reads the cached getMenuByUrl.
 *
 * Returns null ONLY when the menu genuinely doesn't exist. A fetch failure
 * (cold start, transient DB blip) throws rather than returning null: the page
 * turns null into notFound(), and a 404 screen stays up until someone reloads
 * the TV, while a thrown error renders the segment's error boundary
 * (m/[menuUrl]/error.tsx), which reloads the display every few seconds until
 * the menu is back.
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
          overrideAccess: false,
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

  const imageUrl = getMediaUrl(event.image, 'card')

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
    image: imageUrl,
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
      logoUrl: getMediaUrl(v.logo, 'thumbnail') ?? undefined,
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
          overrideAccess: false,
          where: {
            _status: {
              equals: 'published',
            },
          },
          depth: 3, // Include location, beers, and beer relations (style, image)
          populate: CATALOG_MENU_POPULATE,
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
          overrideAccess: false,
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

/** Cache tag per global; anything else falls back to the site-content tag. */
const GLOBAL_TAGS: Record<string, string> = {
  'coming-soon': CACHE_TAGS.comingSoon,
  'site-seo': CACHE_TAGS.siteSeo,
}

/**
 * Fetch a global by slug
 * Cached based on the global type
 */
export const fetchGlobal = async (slug: string, depth: number = 0) => {
  const tag = GLOBAL_TAGS[slug] ?? CACHE_TAGS.siteContent

  try {
    return await unstable_cache(
      async () => {
        const payload = await getPayload({ config })
        const result = await payload.findGlobal({
          slug: slug as 'coming-soon' | 'site-content' | 'site-seo',
          overrideAccess: false,
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
    const weekKey = toDateKey(monday)

    try {
      return await unstable_cache(
        async (): Promise<WeeklyHoursDay[]> => {
          const payload = await getPayload({ config })

          // Get the location
          const locationResult = await payload.find({
            collection: 'locations',
            overrideAccess: false,
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
          const startDateStr = toDateKey(currentMonday)
          const endDateStr = toDateKey(sunday)

          // Get all holiday hours for this location within this week
          const holidayResult = await payload.find({
            collection: 'holiday-hours',
            overrideAccess: false,
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
            const dateStr = toDateKey(date)
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
function eventWindow(): { from: string; through: string; years: number[] } {
  const from = getTodayEST()
  const [year, month, day] = from.split('-').map(Number)
  const end = new Date(year + 1, month - 1, day, 12)
  const through = toDateKey(end)

  return {
    from,
    through,
    years: year === end.getFullYear() ? [year] : [year, end.getFullYear()],
  }
}

async function findUpcomingPublicEvents(
  payload: Awaited<ReturnType<typeof getPayload>>,
  limit: number,
  locationId?: string,
): Promise<PayloadEvent[]> {
  const { from, through, years } = eventWindow()
  const locationFilter = locationId ? [{ location: { equals: locationId } }] : []
  const [oneOffResult, recurringResult] = await Promise.all([
    payload.find({
      collection: 'events',
      overrideAccess: false,
      where: {
        and: [
          ...locationFilter,
          { date: { greater_than_equal: `${from}T00:00:00.000Z` } },
          { visibility: { equals: 'public' } },
        ],
      },
      sort: 'date',
      limit,
      depth: 1,
    }),
    payload.find({
      collection: 'recurring-events',
      overrideAccess: false,
      where: {
        and: [
          ...locationFilter,
          { active: { equals: true } },
          { visibility: { equals: 'public' } },
          scheduleYearFilter(years),
        ],
      },
      sort: ['year', 'day'],
      limit: 1000,
      depth: 1,
    }),
  ])

  const recurring = expandRecurringEvents(recurringResult.docs as RecurringEvent[], from, through)
  return mergeScheduledEvents(oneOffResult.docs, recurring, limit)
}

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
        const location = await findLocationBySlug(payload, locationSlug)

        if (!location) {
          // Location not found is a valid cacheable result
          return []
        }

        return findUpcomingPublicEvents(payload, limit, location.id)
      },
      [`events-${locationSlug}-${limit}-${todayKey}`],
      { tags: [CACHE_TAGS.events, CACHE_TAGS.locations], revalidate: 300 },
    )()
  } catch (error) {
    logger.error(`Error fetching events for location: ${locationSlug}`, error)
    throw error
  }
}

/** Get upcoming one-off and recurring public events across all locations. */
export const getAllUpcomingEventsFromPayload = async (
  limit: number = 100,
): Promise<PayloadEvent[]> => {
  const todayKey = getTodayEST()

  try {
    return await unstable_cache(
      async () => {
        const payload = await getPayload({ config })
        return findUpcomingPublicEvents(payload, limit)
      },
      [`events-all-${limit}-${todayKey}`],
      { tags: [CACHE_TAGS.events, CACHE_TAGS.locations], revalidate: 300 },
    )()
  } catch (error) {
    logger.error('Error fetching upcoming events', error)
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
        const location = await findLocationBySlug(payload, locationSlug)

        if (!location) {
          // Location not found is a valid cacheable result
          return []
        }

        const locationId = location.id

        const todayStr = getTodayMidnightISO()

        const result = await payload.find({
          collection: 'food',
          overrideAccess: false,
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
const getRecurringFoodGlobal = async (year: number): Promise<RecurringFoodState> => {
  try {
    return await unstable_cache(
      async (): Promise<RecurringFoodState> => {
        const payload = await getPayload({ config })
        // Anonymous: the global, active schedules, and exclusions are public.
        return getRecurringFoodState(payload, { overrideAccess: false, year })
      },
      [`recurring-food-global-${year}`],
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
        const location = await findLocationBySlug(payload, locationSlug)

        if (!location) {
          // Location not found is a valid cacheable result
          return []
        }

        const locationId = location.id

        // The window scans monthsAhead months starting with the current one, so
        // it can touch at most this year and the next.
        const now = new Date()
        const lastMonth = new Date(now.getFullYear(), now.getMonth() + monthsAhead - 1, 1)
        const years = [...new Set([now.getFullYear(), lastMonth.getFullYear()])]
        const recurringFoodByYear = new Map(
          (await Promise.all(years.map((year) => getRecurringFoodGlobal(year)))).map((state) => [
            state.year,
            state,
          ]),
        )

        // Collect all vendor IDs to fetch in batch
        const vendorIds = new Set<string>()
        for (const recurringFood of recurringFoodByYear.values()) {
          const locationSchedule = recurringFood.schedules[locationId] || {}
          for (const day of recurringDays) {
            for (const week of recurringOccurrences) {
              const vendorId = locationSchedule[day]?.[week]
              if (vendorId) vendorIds.add(vendorId)
            }
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
            overrideAccess: false,
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
            const slotHasVendor = [...recurringFoodByYear.values()].some(
              (state) => state.schedules[locationId]?.[day]?.[week],
            )
            if (!slotHasVendor) continue

            for (const date of getUpcomingDatesForSlot(dayIndex, weekIndex + 1, monthsAhead)) {
              const recurringFood = recurringFoodByYear.get(date.getFullYear())
              if (!recurringFood) continue
              const vendorId = recurringFood.schedules[locationId]?.[day]?.[week]
              const vendor = vendorId ? vendorMap[vendorId] : undefined
              if (!vendor) continue
              const dateKey = toDateKey(date)
              const locationExclusions = recurringFood.exclusions[locationId] || []
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
          overrideAccess: false,
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
              customerType: dist.customerType || '',
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
          overrideAccess: false,
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
