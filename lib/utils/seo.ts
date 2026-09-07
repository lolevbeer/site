/**
 * Shared Open Graph / title strings so page-level metadata cannot drift from
 * the root layout or drop og:image via Next.js shallow merge.
 *
 * Taproom names in descriptions come from Payload via {@link joinLocationNames}
 * — do not hardcode Lawrenceville/Zelienople here.
 */

import { joinLocationNames } from '@/lib/config/locations'
import type { PayloadLocation } from '@/lib/types/location'

export const SITE_TITLE = 'Lolev Beer - Craft Brewery in Pittsburgh'

export function siteDescription(locations: Array<{ name?: string | null }> = []): string {
  const names = joinLocationNames(locations)
  const where = names ? ` with locations in ${names}` : ''
  return `Experience exceptional craft beer at Lolev Beer${where}. Fresh brews, local food, and community events.`
}

export function beersDescription(locations: Array<{ name?: string | null }> = []): string {
  const names = joinLocationNames(locations)
  const where = names ? ` from our ${names} taprooms` : ' from our taprooms'
  return `Explore Lolev Beer's catalog of hop-saturated ales, hazy IPAs, and crisp lagers${where}.`
}

export function eventsDescription(locations: Array<{ name?: string | null }> = []): string {
  const names = joinLocationNames(locations)
  const where = names ? ` at our ${names} locations` : ''
  return `Discover upcoming events at Lolev Beer. From trivia nights to live music, find your next great experience${where}.`
}

export function foodDescription(locations: Array<{ name?: string | null }> = []): string {
  const names = joinLocationNames(locations)
  const where = names ? ` in ${names}` : ''
  return `Food trucks and vendors at Lolev Beer${where}`
}

export function beerMapDescription(locations: Array<{ name?: string | null }> = []): string {
  const names = joinLocationNames(locations)
  const taprooms = names ? `taprooms in ${names}` : 'our taprooms'
  return `Find Lolev Beer ${taprooms}, plus retailers across Pennsylvania, New York, and Ohio.`
}

export function locationKeywords(locations: PayloadLocation[]): string[] {
  return locations.flatMap((location) => {
    const city = location.address?.city
    return [location.name, city].filter((value): value is string => Boolean(value))
  })
}

/** Fallback when a caller has no location docs (tests, error paths). */
export const SITE_DESCRIPTION = siteDescription()

/** Compressed 1200×630 social card. Keep this on every page-level `openGraph`. */
export const DEFAULT_OG_IMAGE_PATH = '/images/beer/og-image.jpg'

export const DEFAULT_OG_IMAGES = [
  {
    url: DEFAULT_OG_IMAGE_PATH,
    width: 1200,
    height: 630,
    alt: 'Lolev Beer - Craft Brewery in Pittsburgh',
  },
]
