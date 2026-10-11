/**
 * Projections for data that server pages hand to client components.
 *
 * Everything passed to a 'use client' component is serialized into the page's
 * RSC payload and hydrated in the browser. Whole Payload docs carry media
 * `sizes` objects, populated locations, SEO groups and review data that the UI
 * never reads, so these helpers keep only what the client renders. Server-only
 * consumers (JSON-LD) keep using the full docs.
 *
 * Each projection keeps the original type's shape, so client components take
 * the projected data with no prop or type changes. When a component starts
 * reading a new field, add it here too; the render-equality tests in
 * tests/int/public-client-payloads.int.spec.tsx catch a missed field.
 */
import type { FoodVendorSchedule } from '@/lib/types/food'
import type { Beer, Media, Menu } from '@/src/payload-types'
import { extractBeerFromMenuItem, extractProductFromMenuItem } from './menu-item-utils'

/** A /food schedule row with only the fields FoodPageClient reads. */
export type FoodPageSchedule = Pick<
  FoodVendorSchedule,
  'vendor' | 'date' | 'time' | 'site' | 'logoUrl' | 'location'
>

/**
 * Shrink /food schedules to the rendered fields. FoodPageClient shows
 * `time || start`, so the two fold into `time`; undefined fields are dropped
 * because they don't survive serialization anyway.
 */
export function toFoodPageSchedules(schedules: FoodVendorSchedule[]): FoodPageSchedule[] {
  return schedules.map(({ vendor, date, time, start, site, logoUrl, location }) => {
    const row: FoodPageSchedule = { vendor, date, time: time || start, location }
    if (site) row.site = site
    if (logoUrl) row.logoUrl = logoUrl
    return row
  })
}

/**
 * Keep only the URLs the homepage resolves through getMediaUrl: the original
 * plus the `thumbnail` (hero carousel) and `card` (cans grid) derivatives.
 * Returns the input unchanged when it isn't a populated Media doc.
 */
function toHomeImage(image: Beer['image']): Beer['image'] {
  if (!image || typeof image !== 'object') return image
  const sizes: NonNullable<Media['sizes']> = {}
  if (image.sizes?.thumbnail?.url) sizes.thumbnail = { url: image.sizes.thumbnail.url }
  if (image.sizes?.card?.url) sizes.card = { url: image.sizes.card.url }
  return { url: image.url, sizes } as Media
}

/**
 * A beer with only the fields the homepage hero carousel, draft list and cans
 * grid read (see convertMenuItems in components/home/featured-menu.tsx). The
 * description, hops and sprite sheet are /m board fields the homepage omits.
 */
export function toHomeBeer(beer: Beer): Beer {
  return {
    id: beer.id,
    name: beer.name,
    slug: beer.slug,
    style: typeof beer.style === 'object' ? { name: beer.style.name } : beer.style,
    glass: beer.glass,
    abv: beer.abv,
    image: toHomeImage(beer.image),
    draftPrice: beer.draftPrice,
    halfPour: beer.halfPour,
    halfPourOnly: beer.halfPourOnly,
    fourPack: beer.fourPack,
    bottlePrice: beer.bottlePrice,
    recipe: beer.recipe,
    hideFromSite: beer.hideFromSite,
    collab: beer.collab,
    collabBrewery: beer.collabBrewery,
    untappdRating: beer.untappdRating,
    topBeerDrops: beer.topBeerDrops,
    createdAt: beer.createdAt,
  } as Beer
}

/**
 * A homepage menu: id (admin edit link), type, location slug and name, and
 * items with their price, promotion and projected beer or product.
 */
export function toHomeMenu(menu: Menu): Menu {
  const location =
    typeof menu.location === 'object'
      ? { id: menu.location.id, slug: menu.location.slug, name: menu.location.name }
      : menu.location
  return {
    id: menu.id,
    type: menu.type,
    location,
    items: (menu.items ?? []).map((item) => {
      const beer = extractBeerFromMenuItem(item)
      const product = beer ? null : extractProductFromMenuItem(item)
      return {
        product: beer
          ? { relationTo: 'beers', value: toHomeBeer(beer) }
          : product
            ? { relationTo: 'products', value: product }
            : null,
        price: item.price,
        promotion: item.promotion,
      }
    }),
  } as Menu
}
