import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'https://lolev.beer'

  // Private/utility paths kept out of all crawlers, AI bots included.
  const disallow = ['/inventory', '/distributors', '/sarene', '/qr/', '/barcode/', '/admin', '/m/']

  // Explicitly welcome AI crawlers (they're already covered by '*'; naming them
  // is a clearer signal that AI indexing is wanted) while keeping private paths off-limits.
  const aiBots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'PerplexityBot', 'Google-Extended', 'CCBot']

  return {
    rules: [
      { userAgent: '*', disallow },
      ...aiBots.map((userAgent) => ({ userAgent, allow: '/', disallow })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
