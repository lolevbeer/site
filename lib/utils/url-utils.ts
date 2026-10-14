/**
 * URL utility functions
 * Consolidated URL normalization for consistent handling across the app
 */

/** Allow only http(s) hrefs from CMS fields (directionsUrl, vendor sites). */
export function safeHttpUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString()
  } catch {
    // Not an absolute URL.
  }
  return undefined
}

/** Vercel Blob public CDN hosts. Keep these absolute so browsers and next/image
 * hit Blob Data Transfer instead of Fast Origin Transfer via /api/media/file/... */
function isVercelBlobHost(hostname: string): boolean {
  return (
    hostname.endsWith('.public.blob.vercel-storage.com') ||
    hostname.endsWith('.blob.vercel-storage.com')
  )
}

/**
 * Normalize a media URL for frontend delivery.
 *
 * - Relative paths stay relative (local/dev and Payload proxy paths).
 * - Vercel Blob CDN absolute URLs stay absolute (production display).
 * - Other absolute URLs (localhost, preview hosts) collapse to pathname so
 *   the same media works across environments without baking in a host.
 *
 * @param url - The URL to normalize
 * @returns Relative path, or absolute Blob CDN URL when applicable
 */
export function normalizeUrl(url: string): string {
  // If already relative, return as-is
  if (url.startsWith('/')) return url

  try {
    const parsed = new URL(url)
    if (isVercelBlobHost(parsed.hostname)) {
      return parsed.toString()
    }
    // Return just the pathname (e.g., "/api/media/file/hades.png")
    return parsed.pathname
  } catch {
    // If URL parsing fails, return original
    return url
  }
}
