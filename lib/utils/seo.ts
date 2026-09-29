/**
 * Shared Open Graph / title strings so page-level metadata cannot drift from
 * the root layout or drop og:image via Next.js shallow merge.
 *
 * Taproom names in descriptions come from Payload via {@link joinLocationNames}
 * — do not hardcode Lawrenceville/Zelienople here.
 */
import type { Metadata } from 'next'

import { joinLocationNames } from '@/lib/config/locations'
import type { PayloadLocation } from '@/lib/types/location'

export const SITE_TITLE = 'Lolev Beer - Craft Brewery in Pittsburgh'

/** Layout `title.template` and og:title default when Site SEO leaves the template blank. */
export const DEFAULT_TITLE_TEMPLATE = '%s | Lolev Beer'

/** Shared with Organization JSON-LD and llms.txt. Meta snippets append taproom names. */
export const ORG_DESCRIPTION =
  'Pittsburgh brewery sourcing specific hop lots from specialty growers worldwide, known for Ultra Hopped Ales, lagers, and oak-aged beer.'

type NamedLocations = Array<{ name?: string | null }>

function locationClause(
  locations: NamedLocations,
  whenNamed: (names: string) => string,
  whenEmpty = '',
): string {
  const names = joinLocationNames(locations)
  return names ? whenNamed(names) : whenEmpty
}

export function siteDescription(locations: NamedLocations = []): string {
  const where = locationClause(locations, (names) => ` Taprooms in ${names}.`)
  return `${ORG_DESCRIPTION}${where}`
}

export function beersDescription(locations: NamedLocations = []): string {
  const where = locationClause(
    locations,
    (names) => ` from our ${names} taprooms`,
    ' from our taprooms',
  )
  return `Explore Lolev Beer's catalog of hop-saturated ales, hazy IPAs, and crisp lagers${where}.`
}

export function eventsDescription(locations: NamedLocations = []): string {
  const where = locationClause(locations, (names) => ` at our ${names} locations`)
  return `Discover upcoming events at Lolev Beer. From trivia nights to live music, find your next great experience${where}.`
}

export function foodDescription(locations: NamedLocations = []): string {
  const where = locationClause(locations, (names) => ` in ${names}`)
  return `This week's food trucks and vendors at Lolev Beer${where}.`
}

export function beerMapDescription(locations: NamedLocations = []): string {
  const taprooms = locationClause(locations, (names) => `taprooms in ${names}`, 'our taprooms')
  return `Where to buy Lolev Beer: ${taprooms}, plus bottle shops and retailers across Pennsylvania, New York, and Ohio. Search the map by city or ZIP.`
}

export function locationKeywords(locations: PayloadLocation[]): string[] {
  return locations.flatMap((location) => {
    const city = location.address?.city
    return [location.name, city].filter((value): value is string => Boolean(value))
  })
}

/** Fallback when a caller has no location docs (tests, error paths). */
export const SITE_DESCRIPTION = siteDescription()

/** TV / kiosk routes — never index even if a crawler ignores robots.txt. */
export const NOINDEX_ROBOTS = { index: false, follow: false } as const

/** CMS "Noindex" checkbox: keep the page out of results but let crawlers follow its links. */
export const NOINDEX_FOLLOW_ROBOTS = { index: false, follow: true } as const

/** Meta tag a TV display page emits once its data loads; usePolling reloads onto a new deploy only after seeing it. */
export const LIVE_DISPLAY_META = 'live-display'

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

/**
 * Open Graph for a page. Next.js shallow-merges `openGraph`, so a page that
 * sets `description` and omits this keeps the layout's site-wide blurb on
 * the share card, and loses the layout's `locale`/`siteName`. Always pass the
 * page description; images default to the site card.
 */
export function pageOpenGraph(
  title: string,
  description: string,
  images: NonNullable<Metadata['openGraph']>['images'] = DEFAULT_OG_IMAGES,
) {
  return {
    title,
    description,
    type: 'website' as const,
    locale: 'en_US',
    siteName: 'Lolev Beer',
    images,
  }
}

/** Blank CMS strings mean "use the code fallback". */
export function trim(value: string | null | undefined): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}
