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
