/**
 * Caching for the machine-read text routes (sitemap.xml, llms-full.txt).
 *
 * As ISR route handlers (`export const revalidate = 3600`) these froze at their
 * last deploy on Vercel: in November 2026 the live sitemap kept listing past
 * recurring events and missed beers added after Nov 18, while feed.xml, built
 * the same way, kept refreshing. The cause isn't visible from outside, so these
 * routes no longer depend on ISR: they render on request and Vercel's CDN keeps
 * each response for an hour (`s-maxage`), serving the old copy for up to a day
 * while it fetches a new one. The Payload reads inside stay tag-cached, so a
 * render is cheap, and at most one runs per hour per CDN region.
 */
export const CRAWLER_ROUTE_CACHE_CONTROL =
  'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
