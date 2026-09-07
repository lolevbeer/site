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
/** Allow only http(s) hrefs from CMS fields (directionsUrl, vendor sites). */
export function safeHttpUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString()
  } catch {
    return undefined
  }
  return undefined
}

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
