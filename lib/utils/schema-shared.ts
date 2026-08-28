/**
 * Small pieces shared by the JSON-LD schema generators.
 *
 * `menu-schema.ts` (schema.org/Menu) and `product-schema.ts`
 * (schema.org/Product) emit different schema types, but they read the same
 * Payload beer documents and point at the same canonical site. The bits of
 * shape-unwrapping and the base URL they both need live here so the two
 * generators cannot drift apart.
 */

/** Canonical public origin used to build absolute URLs in JSON-LD output. */
export const LOLEV_BASE_URL = 'https://lolev.beer'

/**
 * Resolve a Payload beer `style` relationship to its display name.
 *
 * The field arrives as a plain string when the relationship is unpopulated (or
 * when the caller already holds a style name) and as a `{ name }` object once
 * populated. Returns `null` when the value is missing or in neither shape, so
 * each caller can apply its own fallback.
 *
 * Shared because menu-schema and product-schema both derive a style name from
 * this field and previously carried byte-identical copies of this unwrapping.
 */
export function resolveStyleName(style: unknown): string | null {
  if (!style) return null
  if (typeof style === 'string') return style
  if (typeof style === 'object' && 'name' in style) {
    return (style as { name: string }).name
  }
  return null
}
