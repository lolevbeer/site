/**
 * Payload CMS API utility for fetching data
 * Server-side only - uses direct Payload access
 */

import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { cache } from 'react'
import type { Beer as PayloadBeer, Menu as PayloadMenu, Style, Media } from '@/src/payload-types'
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

    // Debug logging
    if (draftMenu) {
      console.log(`🍺 Draft menu for ${locationSlug}: ${draftMenu.items?.length || 0} items`)
    }

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

    // Debug logging
    if (cansMenu) {
      console.log(`📦 Cans menu for ${locationSlug}: ${cansMenu.items?.length || 0} items`)
    }

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
