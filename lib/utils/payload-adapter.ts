/**
 * Adapter to convert Payload CMS types to app Beer types
 * Bridges the gap between Payload schema and existing app interfaces
 */

import type { Beer as PayloadBeer, Menu as PayloadMenu, Style, Media } from '@/src/payload-types'
import type { PayloadLocation } from '@/lib/types/location'
import type { Beer, DraftBeer, CannedBeer } from '@/lib/types/beer'
import { GlassType, BeerStyle } from '@/lib/types/beer'
import { access, constants } from 'fs/promises'
import { join } from 'path'

/**
 * Check if a beer image exists in the public directory
 */
async function imageExists(variant: string): Promise<boolean> {
  const imagePath = join(process.cwd(), 'public', 'images', 'beer', `${variant}.webp`)
  try {
    await access(imagePath, constants.F_OK)
    return true
  } catch {
    return false
  }
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
export async function convertPayloadBeer(payloadBeer: PayloadBeer): Promise<Beer> {
  const styleName = getStyleName(payloadBeer.style)
  const variant = payloadBeer.slug || payloadBeer.name.toLowerCase().replace(/\s+/g, '-')
  const hasImage = await imageExists(variant)

  return {
    variant,
    name: payloadBeer.name,
    type: styleName as BeerStyle,
    abv: payloadBeer.abv,
    glass: payloadBeer.glass as GlassType,
    description: payloadBeer.description || '',
    upc: payloadBeer.upc || undefined,
    glutenFree: false, // Not in Payload schema yet
    image: hasImage,
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
      cansAvailable: false, // Will be determined from menus
      singleCanAvailable: false,
      hideFromSite: payloadBeer.hideFromSite || false,
      tap: undefined, // Will be determined from menus
    },
  }
}

/**
 * Convert Payload Menu items to Draft Beers
 */
export async function convertMenuToDraftBeers(menu: PayloadMenu): Promise<DraftBeer[]> {
  if (!menu.items || menu.type !== 'draft') {
    return []
  }

  const draftBeers: DraftBeer[] = []

  for (let i = 0; i < menu.items.length; i++) {
    const item = menu.items[i]
    const beer = typeof item.beer === 'string' ? null : item.beer as PayloadBeer

    if (!beer) continue

    const baseBeer = await convertPayloadBeer(beer)
    const tapNumber = (i + 1).toString() // Use array index as tap number

    draftBeers.push({
      ...baseBeer,
      tap: tapNumber,
      price: item.price || baseBeer.pricing.draftPrice?.toString() || '',
      pricing: {
        ...baseBeer.pricing,
        draftPrice: item.price ? parseFloat(item.price) : baseBeer.pricing.draftPrice,
      },
    })
  }

  return draftBeers
}

/**
 * Convert Payload Menu items to Canned Beers
 */
export async function convertMenuToCannedBeers(menu: PayloadMenu): Promise<CannedBeer[]> {
  if (!menu.items || menu.type !== 'cans') {
    return []
  }

  const cannedBeers: CannedBeer[] = []

  for (const item of menu.items) {
    const beer = typeof item.beer === 'string' ? null : item.beer as PayloadBeer

    if (!beer) continue

    const baseBeer = await convertPayloadBeer(beer)

    cannedBeers.push({
      ...baseBeer,
      cansAvailable: true,
      cansSingle: beer.canSingle?.toString() || '',
      fourPack: beer.fourPack?.toString() || '',
      availability: {
        ...baseBeer.availability,
        cansAvailable: true,
        singleCanAvailable: false,
      },
    })
  }

  return cannedBeers
}

/**
 * Get beers with availability data from menus
 * Enriches base beer data with menu/location information
 */
export async function getBeersWithAvailability(
  beers: PayloadBeer[],
  menus: PayloadMenu[]
): Promise<Beer[]> {
  const beerMap = new Map<string, Beer>()

  // First convert all beers
  for (const payloadBeer of beers) {
    const beer = await convertPayloadBeer(payloadBeer)
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
        // Initialize location availability if not present
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
