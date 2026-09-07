/**
 * Small pieces shared by the JSON-LD schema generators.
 *
 * `menu-schema.ts` (schema.org/Menu) and `product-schema.ts`
 * (schema.org/Product) emit different schema types, but they read the same
 * Payload beer documents and point at the same canonical site. The base URL they both need lives
 * here so the two generators cannot drift apart. Style-name unwrapping is not
 * here on purpose: `relationshipName` in ./relationship-name.ts is already the
 * single home for that idiom, and a second copy is what this refactor exists
 * to remove.
 */

/** Canonical public origin used to build absolute URLs in JSON-LD output. */
export const LOLEV_BASE_URL = 'https://lolev.beer'

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
