/**
 * Adapter to convert Payload CMS types to app Beer types
 * Bridges the gap between Payload schema and existing app interfaces
 */

import type { Beer as PayloadBeer, Menu as PayloadMenu, Style, Media } from '@/src/payload-types'
import type { PayloadLocation } from '@/lib/types/location'
import type { Beer } from '@/lib/types/beer'
import { GlassType, BeerStyle } from '@/lib/types/beer'

/**
 * Normalize a Payload media URL to be relative (domain/port agnostic)
 * This handles URLs like "http://localhost:3002/api/media/file/hades.png"
 * and converts them to "/api/media/file/hades.png"
 */
function normalizeMediaUrl(url: string): string {
  // If already relative, return as-is
  if (url.startsWith('/')) return url

  try {
    const parsed = new URL(url)
    // Return just the pathname (e.g., "/api/media/file/hades.png")
    return parsed.pathname
  } catch {
    // If URL parsing fails, return original
    return url
  }
}

/**
 * Get image URL from Payload beer's image field
 * Returns a relative URL path if image is a Media object with url, otherwise false
 * URLs are normalized to be relative to work with any domain/port
 */
function getImageFromPayload(image: PayloadBeer['image']): string | boolean {
  if (!image) return false
  if (typeof image === 'string') return false // Just an ID reference, not populated
  // It's a Media object
  const media = image as Media
  if (media.url) return normalizeMediaUrl(media.url)
  return false
}

/**
 * Get style name from Payload style field
 */
function getStyleName(style: string | Style): string {
  if (typeof style === 'string') {
    return style
  }
  return style.name
}

/**
 * Get location slug from Payload location field
 */
function getLocationSlug(location: string | PayloadLocation | undefined): string {
  if (!location) return ''
  if (typeof location === 'string') return location
  return location.slug || location.name.toLowerCase()
}

/**
 * Convert Payload Beer to app Beer interface
 */
function convertPayloadBeer(payloadBeer: PayloadBeer): Beer {
  const styleName = getStyleName(payloadBeer.style)
  const variant = payloadBeer.slug || payloadBeer.name.toLowerCase().replace(/\s+/g, '-')
  const image = getImageFromPayload(payloadBeer.image)

  return {
    id: payloadBeer.id,
    variant,
    name: payloadBeer.name,
    type: styleName as BeerStyle,
    abv: payloadBeer.abv,
    glass: payloadBeer.glass as GlassType,
    description: payloadBeer.description || '',
    upc: payloadBeer.upc || undefined,
    glutenFree: false,
    image,
    untappd: payloadBeer.untappd ? parseInt(payloadBeer.untappd) : undefined,
    recipe: payloadBeer.recipe || undefined,
    hops: payloadBeer.hops || undefined,
    pricing: {
      draftPrice: payloadBeer.draftPrice,
      canSingle: payloadBeer.canSingle || undefined,
      fourPack: payloadBeer.fourPack || undefined,
      cansSingle: payloadBeer.canSingle || undefined,
      salePrice: false,
    },
    availability: {
      cansAvailable: false,
      singleCanAvailable: false,
      hideFromSite: payloadBeer.hideFromSite || false,
      tap: undefined,
    },
  }
}

/**
 * Get beers with availability data from menus
 * Enriches base beer data with menu/location information
 */
export function getBeersWithAvailability(
  beers: PayloadBeer[],
  menus: PayloadMenu[]
): Beer[] {
  const beerMap = new Map<string, Beer>()

  // First convert all beers
  for (const payloadBeer of beers) {
    const beer = convertPayloadBeer(payloadBeer)
    beerMap.set(beer.variant.toLowerCase(), beer)
  }

  // Then enrich with menu data
  for (const menu of menus) {
    if (!menu.items) continue

    const locationSlug = getLocationSlug(typeof menu.location === 'string' ? undefined : menu.location)

    for (let i = 0; i < menu.items.length; i++) {
      const item = menu.items[i]
      const payloadBeer = typeof item.beer === 'string' ? null : item.beer as PayloadBeer

      if (!payloadBeer) continue

      const variant = (payloadBeer.slug || payloadBeer.name.toLowerCase().replace(/\s+/g, '-')).toLowerCase()
      const beer = beerMap.get(variant)

      if (!beer) continue

      // Update availability based on menu type
      if (menu.type === 'draft') {
        beer.availability.tap = (i + 1).toString()
      } else if (menu.type === 'cans') {
        beer.availability.cansAvailable = true
        beer.availability.singleCanAvailable = false
      }

      // Update location-specific availability dynamically
      if (locationSlug) {
        const existingLocAvail = beer.availability[locationSlug]
        if (!existingLocAvail || typeof existingLocAvail !== 'object') {
          beer.availability[locationSlug] = {}
        }
        const locAvail = beer.availability[locationSlug] as { tap?: string; cansAvailable?: boolean }
        if (menu.type === 'draft') {
          locAvail.tap = (i + 1).toString()
        } else if (menu.type === 'cans') {
          locAvail.cansAvailable = true
        }
      }
    }
  }

  return Array.from(beerMap.values())
}
