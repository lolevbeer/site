/**
 * URL utility functions
 * Consolidated URL normalization for consistent handling across the app
 */

/**
 * Normalize a URL to be relative (domain/port agnostic)
 * Converts absolute URLs like "http://localhost:3002/api/media/file/hades.png"
 * to relative paths like "/api/media/file/hades.png"
 *
 * This is useful for:
 * - Making media URLs work across different environments (dev/staging/prod)
 * - Handling Payload CMS media URLs that may include the full domain
 *
 * @param url - The URL to normalize
 * @returns The relative path, or the original string if already relative or invalid
 */
export function normalizeUrl(url: string): string {
  // If already relative, return as-is
  if (url.startsWith('/')) return url

  try {
    const parsed = new URL(url)
    // Return just the pathname (e.g., "/api/media/file/hades.png")
    return parsed.pathname
  } catch {
    // If URL parsing fails, return original
    return url
  }
}
