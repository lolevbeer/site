/**
 * Payload CMS API utility for fetching data
 * Server-side only - uses direct Payload access
 */

import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { cache } from 'react'
import type { Beer as PayloadBeer, Menu as PayloadMenu, Style, Media, HolidayHour, Event as PayloadEvent, Food as PayloadFood } from '@/src/payload-types'
import type { PayloadLocation } from '@/lib/types/location'
import { logger } from '@/lib/utils/logger'

/**
 * Get Payload instance (cached)
 */
const getPayloadInstance = cache(async () => {
  return await getPayload({ config })
})

/**
 * Get all beers from Payload
 */
export const getAllBeersFromPayload = cache(async (): Promise<PayloadBeer[]> => {
  try {
    const payload = await getPayloadInstance()

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
})

/**
 * Get beer by slug from Payload
 */
export const getBeerBySlug = cache(async (slug: string): Promise<PayloadBeer | null> => {
  try {
    const payload = await getPayloadInstance()

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

    return result.docs[0] || null
  } catch (error) {
    logger.error(`Error fetching beer by slug: ${slug}`, error)
    return null
  }
})

/**
 * Get menus for a specific location
 */
export const getMenusByLocation = cache(async (locationSlug: string): Promise<PayloadMenu[]> => {
  try {
    const payload = await getPayloadInstance()

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
})

/**
 * Get draft menu for a location
 */
export const getDraftMenu = cache(async (locationSlug: string): Promise<PayloadMenu | null> => {
  try {
    const menus = await getMenusByLocation(locationSlug)
    const draftMenu = menus.find(menu => menu.type === 'draft') || null

    return draftMenu
  } catch (error) {
    logger.error(`Error fetching draft menu for location: ${locationSlug}`, error)
    return null
  }
})

/**
 * Get cans menu for a location
 */
export const getCansMenu = cache(async (locationSlug: string): Promise<PayloadMenu | null> => {
  try {
    const menus = await getMenusByLocation(locationSlug)
    const cansMenu = menus.find(menu => menu.type === 'cans') || null

    // Sort menu items by beer recipe (descending - newest first)
    if (cansMenu && cansMenu.items) {
      cansMenu.items.sort((a, b) => {
        const beerA = typeof a.beer === 'object' ? a.beer : null
        const beerB = typeof b.beer === 'object' ? b.beer : null
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
})

/**
 * Get menu by URL slug (e.g., 'lawrenceville-draft', 'zelienople-cans')
 */
export const getMenuByUrl = cache(async (url: string): Promise<PayloadMenu | null> => {
  try {
    const payload = await getPayloadInstance()

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
})

/**
 * Get all active locations from Payload
 */
export const getAllLocations = cache(async () => {
  try {
    const payload = await getPayloadInstance()

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
})

/**
 * Get all styles from Payload
 */
export const getAllStyles = cache(async () => {
  try {
    const payload = await getPayloadInstance()

    const result = await payload.find({
      collection: 'styles',
      sort: 'name',
    })

    return result.docs
  } catch (error) {
    logger.error('Error fetching styles from Payload', error)
    return []
  }
})

/**
 * Helper to get style name from Beer style field
 */
export function getStyleName(style: string | Style): string {
  if (typeof style === 'string') {
    return style
  }
  return style.name
}

/**
 * Helper to get image URL from Beer image field
 */
export function getImageUrl(image: string | Media | null | undefined): string | undefined {
  if (!image) return undefined
  if (typeof image === 'string') return image
  return image.url || undefined
}

// getBeerImageUrl moved to formatters.ts for client-side compatibility

/**
 * Get available beers from all location menus
 * Returns unique beers that appear on any published menu
 */
export const getAvailableBeersFromMenus = cache(async (): Promise<PayloadBeer[]> => {
  try {
    const payload = await getPayloadInstance()

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
        const beer = typeof item.beer === 'object' ? item.beer : null
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
})

/**
 * Get Coming Soon beers from Payload global
 */
export const getComingSoonBeers = cache(async () => {
  try {
    const payload = await getPayloadInstance()

    const result = await payload.findGlobal({
      slug: 'coming-soon',
      depth: 2, // Include beer and style relations
    })

    return result.beers || []
  } catch (error) {
    logger.error('Error fetching coming soon beers', error)
    return []
  }
})

/**
 * Fetch a global by slug
 */
export const fetchGlobal = cache(async (slug: string) => {
  try {
    const payload = await getPayloadInstance()
    const result = await payload.findGlobal({
      slug: slug as 'coming-soon' | 'site-content',
      depth: 0,
    })
    return result
  } catch (error) {
    logger.error(`Error fetching global: ${slug}`, error)
    return null
  }
})

/**
 * Get holiday hours override for a specific location and date
 * Returns the override if one exists, null otherwise
 */
export const getHolidayHours = cache(async (locationId: string, date: Date): Promise<HolidayHour | null> => {
  try {
    const payload = await getPayloadInstance()

    // Format date to match Payload date storage (YYYY-MM-DD)
    const dateStr = date.toISOString().split('T')[0]

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
})

/**
 * Get all holiday hours for a location (upcoming and recent)
 * Useful for displaying a list of special hours
 */
export const getHolidayHoursForLocation = cache(async (locationId: string): Promise<HolidayHour[]> => {
  try {
    const payload = await getPayloadInstance()

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
})

/**
 * Get location by slug with holiday hours check for today
 * Returns location data with any applicable holiday hours override
 */
export const getLocationWithHolidayHours = cache(async (locationSlug: string, date?: Date): Promise<{
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
})

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
 */
export const getWeeklyHoursWithHolidays = cache(async (locationId: string): Promise<WeeklyHoursDay[]> => {
  try {
    const payload = await getPayloadInstance()

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
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(now)
    monday.setDate(now.getDate() + mondayOffset)
    monday.setHours(0, 0, 0, 0)

    // Calculate the end of the week (Sunday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    // Format dates for query
    const startDateStr = monday.toISOString().split('T')[0]
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
      const dateStr = holiday.date.split('T')[0]
      holidayMap.set(dateStr, holiday)
    }

    // Build the weekly hours array
    const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const weeklyHours: WeeklyHoursDay[] = []

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
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
})

/**
 * Get weekly hours for all active locations
 * Returns a map of location slug to weekly hours
 */
export const getAllLocationsWeeklyHours = cache(async (): Promise<Map<string, WeeklyHoursDay[]>> => {
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
})

/**
 * Get upcoming events for a location from Payload
 * Returns events with date >= today, sorted by date ascending
 */
export const getUpcomingEventsFromPayload = cache(async (locationSlug: string, limit: number = 10): Promise<PayloadEvent[]> => {
  try {
    const payload = await getPayloadInstance()

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
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString()

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
})

/**
 * Get upcoming food vendors for a location from Payload
 * Returns food entries with date >= today, sorted by date ascending
 */
export const getUpcomingFoodFromPayload = cache(async (locationSlug: string, limit: number = 10): Promise<PayloadFood[]> => {
  try {
    const payload = await getPayloadInstance()

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
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString()

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
})

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
