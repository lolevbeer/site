/**
 * Canonical origin, social profile URLs, and coordinate unwrapping shared by
 * the JSON-LD generators.
 */

/** Canonical public origin used to build absolute URLs in JSON-LD output. */
export const LOLEV_BASE_URL = 'https://lolev.beer'

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
 * Payload `point` fields arrive as `[lng, lat]` or GeoJSON `{ type, coordinates }`.
 */
export function normalizeLngLat(
  coordinates: unknown,
): [number, number] | null {
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
