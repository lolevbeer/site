/**
 * Payload CMS API utility for fetching data
 * Server-side only - uses direct Payload access
 * Uses unstable_cache for cross-request caching with tag-based invalidation
 */

import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import type { Beer as PayloadBeer, Menu as PayloadMenu, Style, HolidayHour, Event as PayloadEvent, Food as PayloadFood, Distributor } from '@/src/payload-types'
import type { PayloadLocation } from '@/lib/types/location'
import { logger } from '@/lib/utils/logger'
import { CACHE_TAGS } from '@/lib/utils/cache'
import { extractBeerFromMenuItem } from './menu-item-utils'

/**
 * Get Payload instance (request-scoped cache only)
 * This uses React cache since it's per-request and shouldn't persist
 */
const getPayloadInstance = cache(async () => {
  return await getPayload({ config })
})

/**
 * Get all beers from Payload
 * Cached until 'beers' tag is invalidated
 */
export const getAllBeersFromPayload = unstable_cache(
  async (): Promise<PayloadBeer[]> => {
    try {
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
    } catch (error) {
      logger.error('Error fetching beers from Payload', error)
      return []
    }
  },
  ['all-beers'],
  { tags: [CACHE_TAGS.beers], revalidate: 3600 } // 1 hour fallback
)

/**
 * Get beer by slug from Payload
 * Cached until 'beers' tag is invalidated
 */
export const getBeerBySlug = async (slug: string): Promise<PayloadBeer | null> => {
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
      return result.docs[0] || null
    },
    [`beer-${slug}`],
    { tags: [CACHE_TAGS.beers], revalidate: 3600 }
  )()
}

/**
 * Get menus for a specific location
 * Cached until 'menus' or 'locations' tags are invalidated
 */
export const getMenusByLocation = async (locationSlug: string): Promise<PayloadMenu[]> => {
  return unstable_cache(
    async (): Promise<PayloadMenu[]> => {
      try {
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
          logger.warn(`Location not found: ${locationSlug}`)
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
      } catch (error) {
        logger.error(`Error fetching menus for location: ${locationSlug}`, error)
        return []
      }
    },
    [`menus-location-${locationSlug}`],
    { tags: [CACHE_TAGS.menus, CACHE_TAGS.locations], revalidate: 300 } // 5 min fallback
  )()
}

/**
 * Get draft menu for a location
 */
export const getDraftMenu = async (locationSlug: string): Promise<PayloadMenu | null> => {
  try {
    const menus = await getMenusByLocation(locationSlug)
    const draftMenu = menus.find(menu => menu.type === 'draft') || null

    return draftMenu
  } catch (error) {
    logger.error(`Error fetching draft menu for location: ${locationSlug}`, error)
    return null
  }
}

/**
 * Get cans menu for a location
 */
export const getCansMenu = async (locationSlug: string): Promise<PayloadMenu | null> => {
  try {
    const menus = await getMenusByLocation(locationSlug)
    const cansMenu = menus.find(menu => menu.type === 'cans') || null

    // Sort menu items by beer recipe (descending - newest first)
    if (cansMenu && cansMenu.items) {
      cansMenu.items.sort((a, b) => {
        const beerA = extractBeerFromMenuItem(a)
        const beerB = extractBeerFromMenuItem(b)
        const recipeA = beerA?.recipe || 0
        const recipeB = beerB?.recipe || 0
        return recipeB - recipeA
      })
    }

    return cansMenu
  } catch (error) {
    logger.error(`Error fetching cans menu for location: ${locationSlug}`, error)
    return null
  }
}

/**
 * Get menu by URL slug (e.g., 'lawrenceville-draft', 'zelienople-cans')
 * Cached until 'menus' tag is invalidated
 */
export const getMenuByUrl = async (url: string): Promise<PayloadMenu | null> => {
  return unstable_cache(
    async (): Promise<PayloadMenu | null> => {
      try {
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
          depth: 3, // Include location, beers, and beer relations (style, image)
          limit: 1,
        })

        return result.docs[0] || null
      } catch (error) {
        logger.error(`Error fetching menu by URL: ${url}`, error)
        return null
      }
    },
    [`menu-url-${url}`],
    { tags: [CACHE_TAGS.menus], revalidate: 60 } // 1 min fallback for menus
  )()
}

/**
 * Get menu by URL slug - UNCACHED version for real-time updates
 * Used by SSE endpoints and menu display pages that need immediate updates
 */
export const getMenuByUrlFresh = async (url: string): Promise<PayloadMenu | null> => {
  try {
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
      depth: 3, // Include location, beers, and beer relations (style, image)
      limit: 1,
    })

    return result.docs[0] || null
  } catch (error) {
    logger.error(`Error fetching menu by URL (fresh): ${url}`, error)
    return null
  }
}

/**
 * Get all active locations from Payload
 * Cached until 'locations' tag is invalidated
 */
export const getAllLocations = unstable_cache(
  async () => {
    try {
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
    } catch (error) {
      logger.error('Error fetching locations from Payload', error)
      return []
    }
  },
  ['all-locations'],
  { tags: [CACHE_TAGS.locations], revalidate: 3600 }
)

/**
 * Get all styles from Payload
 * Cached until 'styles' tag is invalidated
 */
export const getAllStyles = unstable_cache(
  async () => {
    try {
      const payload = await getPayload({ config })

      const result = await payload.find({
        collection: 'styles',
        sort: 'name',
      })

      return result.docs
    } catch (error) {
      logger.error('Error fetching styles from Payload', error)
      return []
    }
  },
  ['all-styles'],
  { tags: [CACHE_TAGS.styles], revalidate: 3600 }
)

/**
 * Helper to get style name from Beer style field
 */
export function getStyleName(style: string | Style): string {
  if (typeof style === 'string') {
    return style
  }
  return style.name
}

// Re-export getMediaUrl as getImageUrl for backward compatibility
export { getMediaUrl as getImageUrl } from './media-utils'

// getBeerImageUrl moved to formatters.ts for client-side compatibility

/**
 * Get available beers from all location menus
 * Returns unique beers that appear on any published menu
 * Cached until 'menus' or 'beers' tags are invalidated
 */
export const getAvailableBeersFromMenus = unstable_cache(
  async (): Promise<PayloadBeer[]> => {
    try {
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
    } catch (error) {
      logger.error('Error fetching available beers from menus', error)
      return []
    }
  },
  ['available-beers-from-menus'],
  { tags: [CACHE_TAGS.menus, CACHE_TAGS.beers], revalidate: 300 }
)

/**
 * Get Coming Soon beers from Payload global
 * Cached until 'coming-soon' tag is invalidated
 */
export const getComingSoonBeers = unstable_cache(
  async () => {
    try {
      const payload = await getPayload({ config })

      const result = await payload.findGlobal({
        slug: 'coming-soon',
        depth: 2, // Include beer and style relations
      })

      return result.beers || []
    } catch (error) {
      logger.error('Error fetching coming soon beers', error)
      return []
    }
  },
  ['coming-soon-beers'],
  { tags: [CACHE_TAGS.comingSoon], revalidate: 300 }
)

/**
 * Fetch a global by slug
 * Cached based on the global type
 */
export const fetchGlobal = async (slug: string, depth: number = 0) => {
  const tag = slug === 'coming-soon' ? CACHE_TAGS.comingSoon : CACHE_TAGS.siteContent

  return unstable_cache(
    async () => {
      try {
        const payload = await getPayload({ config })
        const result = await payload.findGlobal({
          slug: slug as 'coming-soon' | 'site-content',
          depth,
        })
        return result
      } catch (error) {
        logger.error(`Error fetching global: ${slug}`, error)
        return null
      }
    },
    [`global-${slug}`],
    { tags: [tag], revalidate: 300 }
  )()
}

/**
 * Get holiday hours override for a specific location and date
 * Returns the override if one exists, null otherwise
 * Cached until 'holiday-hours' tag is invalidated
 */
export const getHolidayHours = async (locationId: string, date: Date): Promise<HolidayHour | null> => {
  const dateStr = date.toISOString().split('T')[0]

  return unstable_cache(
    async (): Promise<HolidayHour | null> => {
      try {
        const payload = await getPayload({ config })

        const result = await payload.find({
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
                  equals: dateStr,
                },
              },
            ],
          },
          limit: 1,
          depth: 1,
        })

        return result.docs[0] || null
      } catch (error) {
        logger.error(`Error fetching holiday hours for location ${locationId} on ${date}`, error)
        return null
      }
    },
    [`holiday-hours-${locationId}-${dateStr}`],
    { tags: [CACHE_TAGS.holidayHours], revalidate: 300 }
  )()
}

/**
 * Get all holiday hours for a location (upcoming and recent)
 * Useful for displaying a list of special hours
 * Cached until 'holiday-hours' tag is invalidated
 */
export const getHolidayHoursForLocation = async (locationId: string): Promise<HolidayHour[]> => {
  return unstable_cache(
    async (): Promise<HolidayHour[]> => {
      try {
        const payload = await getPayload({ config })

        // Get overrides from 30 days ago to future
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const dateStr = thirtyDaysAgo.toISOString().split('T')[0]

        const result = await payload.find({
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
                  greater_than_equal: dateStr,
                },
              },
            ],
          },
          sort: 'date',
          limit: 100,
          depth: 1,
        })

        return result.docs
      } catch (error) {
        logger.error(`Error fetching holiday hours for location ${locationId}`, error)
        return []
      }
    },
    [`holiday-hours-location-${locationId}`],
    { tags: [CACHE_TAGS.holidayHours], revalidate: 300 }
  )()
}

/**
 * Get location by slug with holiday hours check for today
 * Returns location data with any applicable holiday hours override
 */
export const getLocationWithHolidayHours = async (locationSlug: string, date?: Date): Promise<{
  location: PayloadLocation | null
  holidayHours: HolidayHour | null
}> => {
  try {
    const payload = await getPayloadInstance()

    const locationResult = await payload.find({
      collection: 'locations',
      where: {
        slug: {
          equals: locationSlug,
        },
      },
      limit: 1,
    })

    const location = locationResult.docs[0] || null

    if (!location) {
      return { location: null, holidayHours: null }
    }

    // Check for override on the specified date (or today)
    const checkDate = date || new Date()
    const holidayHours = await getHolidayHours(location.id, checkDate)

    return { location, holidayHours }
  } catch (error) {
    logger.error(`Error fetching location with holiday hours: ${locationSlug}`, error)
    return { location: null, holidayHours: null }
  }
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

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
 */
export const getWeeklyHoursWithHolidays = async (locationId: string): Promise<WeeklyHoursDay[]> => {
  // Calculate week start for cache key
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)
  const weekKey = monday.toISOString().split('T')[0]

  return unstable_cache(
    async (): Promise<WeeklyHoursDay[]> => {
      try {
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
        const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
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
            const regularHours = location[dayName] as { open?: string | null; close?: string | null } | undefined
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
      } catch (error) {
        logger.error(`Error fetching weekly hours with holidays for location ${locationId}`, error)
        return []
      }
    },
    [`weekly-hours-${locationId}-${weekKey}`],
    { tags: [CACHE_TAGS.locations, CACHE_TAGS.holidayHours], revalidate: 300 }
  )()
}

/**
 * Get weekly hours for all active locations
 * Returns a map of location slug to weekly hours
 */
export const getAllLocationsWeeklyHours = async (): Promise<Map<string, WeeklyHoursDay[]>> => {
  try {
    const locations = await getAllLocations()
    const hoursMap = new Map<string, WeeklyHoursDay[]>()

    await Promise.all(
      locations.map(async (location) => {
        const weeklyHours = await getWeeklyHoursWithHolidays(location.id)
        if (location.slug) {
          hoursMap.set(location.slug, weeklyHours)
        }
      })
    )

    return hoursMap
  } catch (error) {
    logger.error('Error fetching all locations weekly hours', error)
    return new Map()
  }
}

/**
 * Get upcoming events for a location from Payload
 * Returns events with date >= today, sorted by date ascending
 * Cached until 'events' tag is invalidated
 */
export const getUpcomingEventsFromPayload = async (locationSlug: string, limit: number = 10): Promise<PayloadEvent[]> => {
  // Use today's date as part of cache key to ensure fresh data each day
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = today.toISOString().split('T')[0]

  return unstable_cache(
    async (): Promise<PayloadEvent[]> => {
      try {
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
          logger.warn(`Location not found: ${locationSlug}`)
          return []
        }

        const locationId = locationResult.docs[0].id

        // Get today's date at midnight EST
        const currentToday = new Date()
        currentToday.setHours(0, 0, 0, 0)
        const todayStr = currentToday.toISOString()

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
      } catch (error) {
        logger.error(`Error fetching events for location: ${locationSlug}`, error)
        return []
      }
    },
    [`events-${locationSlug}-${limit}-${todayKey}`],
    { tags: [CACHE_TAGS.events, CACHE_TAGS.locations], revalidate: 300 }
  )()
}

/**
 * Get upcoming food vendors for a location from Payload
 * Returns food entries with date >= today, sorted by date ascending
 * Cached until 'food' tag is invalidated
 */
export const getUpcomingFoodFromPayload = async (locationSlug: string, limit: number = 10): Promise<PayloadFood[]> => {
  // Use today's date as part of cache key to ensure fresh data each day
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = today.toISOString().split('T')[0]

  return unstable_cache(
    async (): Promise<PayloadFood[]> => {
      try {
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
          logger.warn(`Location not found: ${locationSlug}`)
          return []
        }

        const locationId = locationResult.docs[0].id

        // Get today's date at midnight EST
        const currentToday = new Date()
        currentToday.setHours(0, 0, 0, 0)
        const todayStr = currentToday.toISOString()

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
          depth: 1,
        })

        return result.docs
      } catch (error) {
        logger.error(`Error fetching food for location: ${locationSlug}`, error)
        return []
      }
    },
    [`food-${locationSlug}-${limit}-${todayKey}`],
    { tags: [CACHE_TAGS.food, CACHE_TAGS.locations], revalidate: 300 }
  )()
}

// ============ RECURRING FOOD ============

const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
const weeks = ['first', 'second', 'third', 'fourth', 'fifth'] as const

type Day = (typeof days)[number]
type Week = (typeof weeks)[number]

type LocationSchedule = Partial<Record<Day, Partial<Record<Week, string | null>>>>
type SchedulesData = Record<string, LocationSchedule>
type ExclusionsData = Record<string, string[]>

interface RecurringFoodGlobal {
  schedules: SchedulesData
  exclusions: ExclusionsData
}

/**
 * Calculate upcoming occurrences of a specific week/day combo
 * e.g., "2nd Tuesday" -> next N dates that are the 2nd Tuesday of their month
 */
function getUpcomingDatesForSlot(dayIndex: number, weekOccurrence: number, monthsAhead: number = 6): Date[] {
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
 * Get the recurring food global configuration
 * Cached until 'recurring-food' tag is invalidated
 */
export const getRecurringFoodGlobal = unstable_cache(
  async (): Promise<RecurringFoodGlobal> => {
    try {
      const payload = await getPayload({ config })
      const result = await payload.findGlobal({
        slug: 'recurring-food',
      })
      return {
        schedules: (result as any).schedules || {},
        exclusions: (result as any).exclusions || {},
      }
    } catch (error) {
      logger.error('Error fetching recurring food global', error)
      return { schedules: {}, exclusions: {} }
    }
  },
  ['recurring-food-global'],
  { tags: [CACHE_TAGS.food], revalidate: 300 }
)

export interface RecurringFoodEntry {
  id: string
  vendor: {
    id: string
    name: string
    site?: string | null
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
export const getUpcomingRecurringFood = async (
  locationSlug: string,
  limit: number = 10,
  monthsAhead: number = 3
): Promise<RecurringFoodEntry[]> => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = today.toISOString().split('T')[0]

  return unstable_cache(
    async (): Promise<RecurringFoodEntry[]> => {
      try {
        const payload = await getPayload({ config })

        // Get location ID from slug
        const locationResult = await payload.find({
          collection: 'locations',
          where: { slug: { equals: locationSlug } },
          limit: 1,
        })

        if (locationResult.docs.length === 0) {
          logger.warn(`Location not found: ${locationSlug}`)
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
        for (const day of days) {
          for (const week of weeks) {
            const vendorId = locationSchedule[day]?.[week]
            if (vendorId) vendorIds.add(vendorId)
          }
        }

        // Fetch all vendors in one request
        const vendorMap: Record<string, { id: string; name: string; site?: string | null }> = {}
        if (vendorIds.size > 0) {
          const vendorResult = await payload.find({
            collection: 'food-vendors',
            where: {
              id: { in: Array.from(vendorIds) },
            },
            limit: vendorIds.size,
          })
          for (const vendor of vendorResult.docs) {
            vendorMap[vendor.id] = {
              id: vendor.id,
              name: vendor.name,
              site: vendor.site,
            }
          }
        }

        // Generate upcoming dates for each scheduled slot
        const entries: RecurringFoodEntry[] = []
        const currentToday = new Date()
        currentToday.setHours(0, 0, 0, 0)

        for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
          const day = days[dayIndex]
          for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
            const week = weeks[weekIndex]
            const vendorId = locationSchedule[day]?.[week]

            if (vendorId && vendorMap[vendorId]) {
              const upcomingDates = getUpcomingDatesForSlot(dayIndex, weekIndex + 1, monthsAhead)

              for (const date of upcomingDates) {
                const dateKey = date.toISOString().split('T')[0]

                // Skip if this date is excluded
                if (locationExclusions.includes(dateKey)) continue

                entries.push({
                  id: `recurring-${locationId}-${day}-${week}-${dateKey}`,
                  vendor: vendorMap[vendorId],
                  date: dateKey,
                  location: locationId,
                  isRecurring: true,
                  dayOfWeek: day,
                  weekOfMonth: week,
                })
              }
            }
          }
        }

        // Sort by date and limit
        entries.sort((a, b) => a.date.localeCompare(b.date))
        return entries.slice(0, limit)
      } catch (error) {
        logger.error(`Error fetching recurring food for location: ${locationSlug}`, error)
        return []
      }
    },
    [`recurring-food-${locationSlug}-${limit}-${monthsAhead}-${todayKey}`],
    { tags: [CACHE_TAGS.food, CACHE_TAGS.locations], revalidate: 300 }
  )()
}

/**
 * Get combined food (individual + recurring) for a location
 * Merges and deduplicates by date
 */
export const getCombinedUpcomingFood = async (
  locationSlug: string,
  limit: number = 10
): Promise<(PayloadFood | RecurringFoodEntry)[]> => {
  const [individual, recurring] = await Promise.all([
    getUpcomingFoodFromPayload(locationSlug, limit),
    getUpcomingRecurringFood(locationSlug, limit),
  ])

  // Create a set of dates that have individual food scheduled
  const individualDates = new Set(
    individual.map((f) => (typeof f.date === 'string' ? f.date.split('T')[0] : ''))
  )

  // Filter out recurring entries that conflict with individual entries
  const filteredRecurring = recurring.filter((r) => !individualDates.has(r.date))

  // Combine and sort
  const combined = [...individual, ...filteredRecurring]
  combined.sort((a, b) => {
    const dateA = 'isRecurring' in a ? a.date : (typeof a.date === 'string' ? a.date.split('T')[0] : '')
    const dateB = 'isRecurring' in b ? b.date : (typeof b.date === 'string' ? b.date.split('T')[0] : '')
    return dateA.localeCompare(dateB)
  })

  return combined.slice(0, limit)
}

// ============ BACKWARD COMPATIBILITY ALIASES ============
// Export aliases for functions that were previously in lib/data/beer-data.ts
// This allows gradual migration without breaking existing imports

/**
 * @deprecated Use getUpcomingEventsFromPayload directly
 * Alias for backward compatibility with lib/data/beer-data.ts
 */
export const getUpcomingEvents = getUpcomingEventsFromPayload

/**
 * @deprecated Use getUpcomingFoodFromPayload directly
 * Alias for backward compatibility with lib/data/beer-data.ts
 */
export const getUpcomingFood = getUpcomingFoodFromPayload

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
export const getAllDistributorsGeoJSON = unstable_cache(
  async (): Promise<DistributorGeoJSON> => {
    try {
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
            address: dist.address,
            customerType: dist.customerType || 'Retail',
            uniqueId: dist.id,
          },
        }))

      return {
        type: 'FeatureCollection',
        features,
      }
    } catch (error) {
      logger.error('Error fetching distributors from Payload', error)
      return { type: 'FeatureCollection', features: [] }
    }
  },
  ['all-distributors-geojson'],
  { tags: [CACHE_TAGS.distributors], revalidate: 3600 }
)
