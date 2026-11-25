/**
 * Caching for the machine-read text routes (sitemap.xml, llms-full.txt).
 *
 * As ISR route handlers (`export const revalidate = 3600`) these froze at their
 * last deploy on Vercel: in November 2026 the live sitemap kept listing past
 * recurring events and missed beers added after Nov 18, while feed.xml, built
 * the same way, kept refreshing. The cause isn't visible from outside, so these
 * routes no longer depend on ISR: they render on request and Vercel's CDN keeps
 * each response for an hour (`s-maxage`). The Payload reads inside stay
 * tag-cached, so a render is cheap.
 *
 * How stale a copy can be: an hour at the CDN, plus up to one more render,
 * because the first render after a save can still get the pre-save cache entry
 * while Next refreshes it in the background. There is no
 * `stale-while-revalidate`: on routes this quiet it handed crawlers
 * yesterday's copy, with event URLs that now 404.
 *
 * The CDN keys on the full URL, so a request with a query string renders again.
 */
const CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600'

/**
 * The Cache-Control for a crawler route's response. `complete` is false when a
 * read failed and its section came out empty: that copy is served but not
 * cached, so the next request tries again instead of replaying it for an hour.
 */
export function crawlerCacheControl(complete: boolean): string {
  return complete ? CACHE_CONTROL : 'no-store'
}
