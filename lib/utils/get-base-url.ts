/**
 * Canonical public origin for metadata, robots, sitemap, Slack, and feeds.
 *
 * Resolution: NEXT_PUBLIC_SITE_URL → VERCEL_PROJECT_PRODUCTION_URL → VERCEL_URL
 * → https://lolev.beer. Never localhost: a wrong production canonical deindexes
 * the site. Local metadata pointing at production is harmless.
 */
export function getBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) {
    const normalized = asAbsoluteHttpUrl(explicit)
    if (normalized) return normalized
  }

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (production) {
    const normalized = asAbsoluteHttpUrl(`https://${production}`)
    if (normalized) return normalized
  }

  const preview = process.env.VERCEL_URL?.trim()
  if (preview) {
    const normalized = asAbsoluteHttpUrl(`https://${preview}`)
    if (normalized) return normalized
  }

  return 'https://lolev.beer'
}

function asAbsoluteHttpUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}
