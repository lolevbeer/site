/**
 * Minimal homepage view models so client leaves do not receive full Payload docs.
 */

import { extractBeerFromMenuItem } from '@/lib/utils/menu-item-utils'
import { getBeerImageUrl } from '@/lib/utils/media-utils'

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
  style?: { name?: string | null } | string | null
  abv?: string | number | null
  hideFromSite?: boolean | null
}

interface MenuLike {
  items?: unknown[] | null
}

export function projectHeroBeers(
  availableBeers: BeerLike[],
  cansMenus: MenuLike[],
): HeroBeerView[] {
  const cansIds = new Set<string>()
  for (const menu of cansMenus) {
    for (const item of menu.items || []) {
      if (!item || typeof item !== 'object') continue
      const beer = extractBeerFromMenuItem(item as Record<string, unknown>)
      if (beer?.id) cansIds.add(String(beer.id))
    }
  }

  const projected: HeroBeerView[] = []
  for (const beer of availableBeers) {
    if (!beer.id || !cansIds.has(String(beer.id))) continue
    const imageUrl = getBeerImageUrl(beer.image, beer.slug || undefined, 'thumbnail')
    if (!imageUrl || !beer.slug || !beer.name) continue
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
    if (!item || typeof item !== 'object') continue
    const beer = extractBeerFromMenuItem(item as Record<string, unknown>) as BeerLike | null
    if (!beer) continue
    const styleName =
      typeof beer.style === 'object' && beer.style?.name
        ? beer.style.name
        : typeof beer.style === 'string'
          ? beer.style
          : ''
    beers.push({
      variant: beer.slug || '',
      name: beer.name || '',
      type: styleName,
      abv: beer.abv || 0,
    })
  }
  return beers
}

export function projectComingSoon(
  entries: Array<{ beer?: BeerLike | string | null; style?: { name?: string | null } | string | null }>,
): ComingSoonView[] {
  return entries.map((item) => {
    const beer = typeof item.beer === 'object' && item.beer ? item.beer : null
    const beerStyle =
      typeof beer?.style === 'object' && beer.style?.name
        ? beer.style.name
        : typeof beer?.style === 'string'
          ? beer.style
          : ''
    const fallbackStyle =
      typeof item.style === 'object' && item.style?.name
        ? item.style.name
        : typeof item.style === 'string'
          ? item.style
          : ''
    return {
      name: beer?.name || '',
      slug: beer?.slug || '',
      styleName: beerStyle || fallbackStyle,
      hideFromSite: Boolean(beer?.hideFromSite),
    }
  })
}
