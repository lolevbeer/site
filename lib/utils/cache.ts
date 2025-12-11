/**
 * Cache utilities for Next.js + Payload CMS integration
 * Uses unstable_cache with tags for on-demand revalidation
 */

import { revalidatePath, revalidateTag } from 'next/cache'

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
} as const

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS]

/**
 * Revalidate a single cache tag
 */
export function revalidateCacheTag(tag: CacheTag) {
  revalidateTag(tag)
}

/**
 * Revalidate multiple cache tags
 */
export function revalidateCacheTags(tags: CacheTag[]) {
  tags.forEach((tag) => revalidateTag(tag))
}

/**
 * Revalidate a path
 */
export function revalidateCachePath(path: string) {
  revalidatePath(path)
}

/**
 * Revalidate multiple paths
 */
export function revalidateCachePaths(paths: string[]) {
  paths.forEach((path) => revalidatePath(path))
}

/**
 * Collection to cache tags mapping
 * Defines which tags should be invalidated when a collection changes
 */
export const COLLECTION_CACHE_MAP: Record<string, CacheTag[]> = {
  beers: [CACHE_TAGS.beers, CACHE_TAGS.menus, CACHE_TAGS.homepage],
  menus: [CACHE_TAGS.menus, CACHE_TAGS.homepage],
  events: [CACHE_TAGS.events, CACHE_TAGS.homepage],
  food: [CACHE_TAGS.food, CACHE_TAGS.homepage],
  locations: [CACHE_TAGS.locations, CACHE_TAGS.homepage, CACHE_TAGS.menus],
  styles: [CACHE_TAGS.styles, CACHE_TAGS.beers],
  'holiday-hours': [CACHE_TAGS.holidayHours, CACHE_TAGS.locations, CACHE_TAGS.homepage],
}

/**
 * Global to cache tags mapping
 */
export const GLOBAL_CACHE_MAP: Record<string, CacheTag[]> = {
  'coming-soon': [CACHE_TAGS.comingSoon, CACHE_TAGS.homepage],
  'site-content': [CACHE_TAGS.siteContent, CACHE_TAGS.homepage],
}
