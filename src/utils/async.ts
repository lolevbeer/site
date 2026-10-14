/**
 * Small async primitives shared across the codebase.
 *
 * `sleep` backs the Nominatim rate limiter in `src/endpoints/geocode.ts`, the
 * one place that paces geocoding requests.
 */

/**
 * Resolve after `ms` milliseconds.
 *
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
