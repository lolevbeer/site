/**
 * Canonical origin, social profile URLs, and coordinate unwrapping shared by
 * the JSON-LD generators.
 */

/** Canonical public origin used to build absolute URLs in JSON-LD output. */
export const LOLEV_BASE_URL = 'https://lolev.beer'

/** Absolute social-card URL used as Organization/Brand/Brewery logo. */
export const LOLEV_OG_IMAGE_URL = `${LOLEV_BASE_URL}/images/beer/og-image.jpg`

/** Public profiles linked from the footer — Organization/LocalBusiness sameAs. */
export const SOCIAL_PROFILE_URLS = [
  'https://www.facebook.com/lolevbeer',
  'https://www.instagram.com/lolevbeer',
  'https://www.threads.net/@lolevbeer',
  'https://www.tiktok.com/@lolevbeer',
  'https://x.com/lolevbeer',
  'https://untappd.com/lolev',
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
