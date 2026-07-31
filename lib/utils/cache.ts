/**
 * Cache utilities for Next.js + Payload CMS integration
 * Uses unstable_cache with tags for on-demand revalidation
 */

// Cache tags for each collection/global
export const CACHE_TAGS = {
  beers: 'beers',
  menus: 'menus',
  events: 'events',
  food: 'food',
  locations: 'locations',
  styles: 'styles',
  holidayHours: 'holiday-hours',
  comingSoon: 'coming-soon',
  siteContent: 'site-content',
  homepage: 'homepage',
  distributors: 'distributors',
  faqs: 'faqs',
} as const

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS]
