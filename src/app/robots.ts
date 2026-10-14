import { MetadataRoute } from 'next'
import { getBaseUrl } from '@/lib/utils/get-base-url'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl()

  // Private/utility paths kept out of all crawlers, AI bots included. The
  // per-event .ics downloads have no search value (Google and Bing honor '*').
  const disallow = ['/admin', '/e/', '/m/', '/events/*/calendar.ics']

  // Explicitly welcome AI crawlers (they're already covered by '*'; naming them
  // is a clearer signal that AI indexing is wanted) while keeping private paths off-limits.
  const aiBots = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-SearchBot',
    'Claude-User',
    'PerplexityBot',
    'Google-Extended',
    'CCBot',
  ]

  return {
    rules: [
      { userAgent: '*', disallow },
      ...aiBots.map((userAgent) => ({ userAgent, allow: '/', disallow })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
