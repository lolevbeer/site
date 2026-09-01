/**
 * Minimal homepage view models so client leaves do not receive full Payload docs.
 */

import { extractBeerFromMenuItem } from '@/lib/utils/menu-item-utils'
import { getBeerImageUrl } from '@/lib/utils/media-utils'
import { relationshipName } from '@/lib/utils/relationship-name'

export interface HeroBeerView {
  id: string
  slug: string
  name: string
  imageUrl: string
}

export interface MarketingBeerView {
  variant: string
  name: string
  type: string
  abv: string | number
}

export interface ComingSoonView {
  name: string
  slug: string
  styleName: string
  hideFromSite: boolean
}

interface BeerLike {
  id?: string
  slug?: string | null
  name?: string | null
  image?: unknown
  style?: unknown
  abv?: string | number | null
  hideFromSite?: boolean | null
}

interface MenuLike {
  items?: unknown[] | null
}

function beerFromMenuItem(item: unknown): BeerLike | null {
  if (!item || typeof item !== 'object') return null
  return extractBeerFromMenuItem(item as Record<string, unknown>)
}

export function projectHeroBeers(
  availableBeers: BeerLike[],
  cansMenus: MenuLike[],
): HeroBeerView[] {
  const cansIds = new Set<string>()
  for (const menu of cansMenus) {
    for (const item of menu.items || []) {
      const beer = beerFromMenuItem(item)
      if (beer?.id) cansIds.add(String(beer.id))
    }
  }

  const projected: HeroBeerView[] = []
  for (const beer of availableBeers) {
    if (!beer.id || !cansIds.has(String(beer.id)) || !beer.slug || !beer.name) continue
    const imageUrl = getBeerImageUrl(beer.image, beer.slug, 'thumbnail')
    if (!imageUrl) continue
    projected.push({
      id: String(beer.id),
      slug: beer.slug,
      name: beer.name,
      imageUrl,
    })
  }
  return projected
}

export function projectMarketingBeers(menu: MenuLike | null | undefined): MarketingBeerView[] {
  if (!menu?.items) return []
  const beers: MarketingBeerView[] = []
  for (const item of menu.items) {
    const beer = beerFromMenuItem(item)
    if (!beer) continue
    beers.push({
      variant: beer.slug || '',
      name: beer.name || '',
      type: relationshipName(beer.style) || '',
      abv: beer.abv || 0,
    })
  }
  return beers
}

export function projectMarketingBeersByLocation(
  menusByLocation: Record<string, MenuLike | null | undefined>,
): Record<string, MarketingBeerView[]> {
  const projected: Record<string, MarketingBeerView[]> = {}
  for (const [slug, menu] of Object.entries(menusByLocation)) {
    projected[slug] = projectMarketingBeers(menu)
  }
  return projected
}

export function projectComingSoon(
  entries: Array<{
    beer?: BeerLike | string | null
    style?: { name?: string | null } | string | null
  }>,
): ComingSoonView[] {
  return entries.map((item) => {
    const beer = typeof item.beer === 'object' && item.beer ? item.beer : null
    return {
      name: beer?.name || '',
      slug: beer?.slug || '',
      styleName: relationshipName(beer?.style) || relationshipName(item.style) || '',
      hideFromSite: Boolean(beer?.hideFromSite),
    }
  })
}
