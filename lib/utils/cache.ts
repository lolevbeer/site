/**
 * Cache utilities for Next.js + Payload CMS integration
 * Uses unstable_cache with tags for on-demand revalidation
 */

// Cache tags for each collection/global
export const CACHE_TAGS = {
  beers: 'beers',
  menus: 'menus',
  // Only the kiosk menu stream carries this, so it can be hard-expired without
  // forcing synchronous rebuilds of public pages that share 'menus'.
  kioskMenus: 'kiosk-menus',
  events: 'events',
  food: 'food',
  locations: 'locations',
  styles: 'styles',
  holidayHours: 'holiday-hours',
  comingSoon: 'coming-soon',
  siteContent: 'site-content',
  siteSeo: 'site-seo',
  homepage: 'homepage',
  distributors: 'distributors',
  faqs: 'faqs',
  jobs: 'jobs',
} as const

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS]

/**
 * Cache-key part for per-viewer caches: user id plus the access fields that
 * decide what they can read (roles, locations), so a role or location change
 * misses the old entry instead of serving it until it expires.
 */
export function accessKey(req: { user?: unknown }): string {
  const user = req.user as { id?: unknown; roles?: unknown; locations?: unknown } | null | undefined
  return JSON.stringify([user?.id, user?.roles, user?.locations])
}
