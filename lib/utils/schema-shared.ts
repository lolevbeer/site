/**
 * Canonical origin, JSON-LD @ids, social profile URLs, and coordinate
 * unwrapping shared by the JSON-LD generators.
 */

/** Canonical public origin used to build absolute URLs in JSON-LD output. */
export const LOLEV_BASE_URL = 'https://lolev.beer'

/**
 * Canonical @id of the Lolev Organization. The sitewide layout graph defines
 * it; page-level Organization nodes reuse it to add page-specific facts, and
 * Event, WebSite, and WebPage nodes reference it.
 */
export const LOLEV_ORG_ID = `${LOLEV_BASE_URL}/#org`

/** Canonical @id of the WebSite node, defined once in the sitewide layout graph. */
export const LOLEV_WEBSITE_ID = `${LOLEV_BASE_URL}/#website`

/** Canonical @id of a taproom Brewery, shared by the sitewide and page-level nodes. */
export function locationSchemaId(slug: string): string {
  return `${LOLEV_BASE_URL}/#${slug}`
}

/** Absolute social-card URL used as Organization/Brand/Brewery logo. */
export const LOLEV_OG_IMAGE_URL = `${LOLEV_BASE_URL}/images/beer/og-image.jpg`

/** Instagram profile linked from the footer and published in JSON-LD. */
export const INSTAGRAM_PROFILE_URL = 'https://www.instagram.com/lolevbeer'

/** X profile (@lolevbeer) linked from the footer and published in JSON-LD. */
export const X_PROFILE_URL = 'https://x.com/lolevbeer'

/** Public profiles linked from the footer — Organization/LocalBusiness sameAs. */
export const SOCIAL_PROFILE_URLS = [
  'https://www.facebook.com/lolevbeer',
  INSTAGRAM_PROFILE_URL,
  'https://www.threads.net/@lolevbeer',
  'https://www.tiktok.com/@lolevbeer',
  X_PROFILE_URL,
  'https://untappd.com/lolev',
]

/**
 * sameAs for the crawlable Organization node. Instagram and X are the footer
 * profiles above. Untappd, BeerAdvocate, and Facebook use the public profile
 * URLs those sites publish for Lolev.
 */
export const CRAWLABLE_SAME_AS = [
  'https://untappd.com/Lolev',
  'https://www.beeradvocate.com/beer/profile/64204/',
  'https://www.facebook.com/lolevbeer/',
  INSTAGRAM_PROFILE_URL,
  X_PROFILE_URL,
]

/**
 * sameAs for the canonical Organization. The sitewide node publishes every
 * profile that page-level Organization nodes and Event organizers used to
 * repeat inline, so those can reference the node by @id without losing links.
 */
export const ORGANIZATION_SAME_AS = [...new Set([...CRAWLABLE_SAME_AS, ...SOCIAL_PROFILE_URLS])]

/**
 * Founding year published on every Organization node with the canonical @id.
 * The sources disagree on precision (page Organization said 2022, the layout
 * node said 2022-12); only the year is common to both, so only the year is
 * asserted. The month is an unresolved source inconsistency, not a fact.
 */
export const LOLEV_FOUNDING_DATE = '2022'

/**
 * Payload `point` fields arrive as `[lng, lat]` or GeoJSON `{ type, coordinates }`.
 */
export function normalizeLngLat(coordinates: unknown): [number, number] | null {
  if (Array.isArray(coordinates) && coordinates.length === 2) {
    const [lng, lat] = coordinates
    if (typeof lng === 'number' && typeof lat === 'number') return [lng, lat]
  }
  if (
    coordinates &&
    typeof coordinates === 'object' &&
    'coordinates' in coordinates &&
    Array.isArray((coordinates as { coordinates: unknown }).coordinates)
  ) {
    return normalizeLngLat((coordinates as { coordinates: unknown }).coordinates)
  }
  return null
}
