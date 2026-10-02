/**
 * Server-side projections for public pages whose client components render only a few fields.
 * Call these in the server page, not inside a 'use client' component, so full CMS objects never
 * become client props. Pages keep the full objects for JSON-LD and other server work.
 */
import type { BreweryEvent } from '@/lib/types/event'
import type { FoodVendorSchedule } from '@/lib/types/food'
import type { Beer, Menu } from '@/src/payload-types'
import { getBeerImageUrl } from '@/lib/utils/media-utils'
import { extractBeerFromMenuItem } from '@/lib/utils/menu-item-utils'

/** A cans-menu beer as the home hero carousel renders it. */
export interface HeroCanBeer {
  id: string
  slug: string
  name: string
  /** Resolved thumbnail URL; beers without one are dropped. */
  imageUrl: string
}

/** The food fields FoodPageClient reads. */
export type FoodClientItem = Pick<
  FoodVendorSchedule,
  'vendor' | 'date' | 'location' | 'time' | 'start' | 'site' | 'logoUrl'
>

/** The event fields EventsPageClient reads. */
export type EventClientItem = Pick<
  BreweryEvent,
  'id' | 'title' | 'description' | 'date' | 'time' | 'endTime' | 'location' | 'site'
>

/**
 * Beers (in `availableBeers` order) that sit on any cans menu and have a thumbnail.
 * Menu items whose beer relationship is not populated are skipped, as before.
 */
export function projectHeroCanBeers(availableBeers: Beer[], cansMenus: Menu[]): HeroCanBeer[] {
  const cansIds = new Set<string>()
  for (const menu of cansMenus) {
    for (const item of menu.items ?? []) {
      const beer = extractBeerFromMenuItem(item)
      if (beer?.id) cansIds.add(beer.id)
    }
  }
  return availableBeers.flatMap((beer) => {
    const imageUrl = cansIds.has(beer.id)
      ? getBeerImageUrl(beer.image, beer.slug, 'thumbnail')
      : null
    return imageUrl ? [{ id: beer.id, slug: beer.slug, name: beer.name, imageUrl }] : []
  })
}

/** Keeps every schedule, in order, with only the fields FoodPageClient reads. */
export function projectFoodForClient(schedules: FoodVendorSchedule[]): FoodClientItem[] {
  return schedules.map(({ vendor, date, location, time, start, site, logoUrl }) => ({
    vendor,
    date,
    location,
    time,
    start,
    site,
    logoUrl,
  }))
}

/** Keeps every event, in order, with only the fields EventsPageClient reads. */
export function projectEventsForClient(events: BreweryEvent[]): EventClientItem[] {
  return events.map(({ id, title, description, date, time, endTime, location, site }) => ({
    id,
    title,
    description,
    date,
    time,
    endTime,
    location,
    site,
  }))
}
