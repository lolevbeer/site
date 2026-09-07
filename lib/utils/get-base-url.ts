/**
 * Canonical public origin for metadata, robots, sitemap, Slack, and feeds.
 *
 * Resolution: NEXT_PUBLIC_SITE_URL → VERCEL_PROJECT_PRODUCTION_URL → VERCEL_URL
 * → https://lolev.beer. Never localhost: a wrong production canonical deindexes
 * the site. Local metadata pointing at production is harmless.
 */
export function getBaseUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    httpsFromHost(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    httpsFromHost(process.env.VERCEL_URL),
  ]

  for (const candidate of candidates) {
    const origin = asAbsoluteHttpUrl(candidate)
    if (origin) return origin
  }

  return 'https://lolev.beer'
}

function httpsFromHost(host: string | undefined): string | undefined {
  const trimmed = host?.trim()
  return trimmed ? `https://${trimmed}` : undefined
}

function asAbsoluteHttpUrl(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}
