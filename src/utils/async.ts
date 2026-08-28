/**
 * Small async primitives shared across the codebase.
 *
 * Extracted because the three import/geocode endpoints each defined their own
 * identical `sleep` to rate-limit Nominatim calls.
 */

/**
 * Resolve after `ms` milliseconds.
 *
 * Used by the distributor importers to stay under the Nominatim geocoding rate
 * limit (roughly one request per second).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
