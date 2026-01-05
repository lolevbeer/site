/**
 * Payload CMS Revalidation Plugin
 *
 * Automatically adds cache revalidation hooks to all collections and globals.
 * When content changes in Payload, the relevant Next.js cache tags are invalidated,
 * ensuring the frontend serves fresh data on the next request.
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import type { Config, Plugin, CollectionConfig, GlobalConfig } from 'payload'

// Cache tags for each collection/global
const CACHE_TAGS = {
  beers: 'beers',
  menus: 'menus',
  events: 'events',
  food: 'food',
  locations: 'locations',
  styles: 'styles',
  distributors: 'distributors',
  'food-vendors': 'food-vendors',
  products: 'products',
  'holiday-hours': 'holiday-hours',
  'coming-soon': 'coming-soon',
  'site-content': 'site-content',
  'recurring-food': 'recurring-food',
  'distributor-settings': 'distributor-settings',
} as const

type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS]

// Collection to cache tags mapping
// Defines which tags should be invalidated when a collection changes
const COLLECTION_CACHE_MAP: Record<string, CacheTag[]> = {
  beers: ['beers', 'menus'], // Beers affect menu displays too
  menus: ['menus'],
  events: ['events'],
  food: ['food'],
  locations: ['locations', 'menus'], // Locations affect menus
  styles: ['styles', 'beers'], // Styles affect beer displays
  distributors: ['distributors'],
  'food-vendors': ['food-vendors', 'food'], // Food vendors affect food displays
  products: ['products', 'menus'], // Products affect menu displays
  'holiday-hours': ['holiday-hours', 'locations'],
}

// Global to cache tags mapping
const GLOBAL_CACHE_MAP: Record<string, CacheTag[]> = {
  'coming-soon': ['coming-soon'],
  'site-content': ['site-content'],
  'recurring-food': ['recurring-food', 'food'],
  'distributor-settings': ['distributor-settings', 'distributors'],
}

// Paths to revalidate for each collection
const COLLECTION_PATHS: Record<string, string[]> = {
  beers: ['/', '/beer'],
  menus: ['/'],
  events: ['/', '/events'],
  food: ['/', '/food'],
  locations: ['/'],
  styles: ['/beer'],
  distributors: ['/beer-map'],
  'food-vendors': ['/food'],
  products: ['/'],
  'holiday-hours': ['/'],
}

// Dynamic path builders for collections with slugs
const COLLECTION_PATH_BUILDERS: Record<string, (doc: Record<string, unknown>) => string[]> = {
  beers: (doc) => (doc.slug ? [`/beer/${doc.slug}`] : []),
  menus: (doc) => (doc.url ? [`/m/${doc.url}`] : []),
}

/**
 * Creates the afterChange hook for a collection
 */
function createCollectionAfterChangeHook(slug: string) {
  return async ({ doc }: { doc: Record<string, unknown> }) => {
    const tags = COLLECTION_CACHE_MAP[slug] || []
    const paths = COLLECTION_PATHS[slug] || []
    const pathBuilder = COLLECTION_PATH_BUILDERS[slug]

    // Revalidate tags
    tags.forEach((tag) => {
      revalidateTag(tag)
    })

    // Revalidate static paths
    paths.forEach((path) => {
      revalidatePath(path)
    })

    // Revalidate dynamic paths
    if (pathBuilder) {
      const dynamicPaths = pathBuilder(doc)
      dynamicPaths.forEach((path) => {
        revalidatePath(path)
      })
    }

    return doc
  }
}

/**
 * Creates the afterDelete hook for a collection
 */
function createCollectionAfterDeleteHook(slug: string) {
  return async ({ doc }: { doc: Record<string, unknown> }) => {
    const tags = COLLECTION_CACHE_MAP[slug] || []
    const paths = COLLECTION_PATHS[slug] || []

    // Revalidate tags
    tags.forEach((tag) => {
      revalidateTag(tag)
    })

    // Revalidate static paths
    paths.forEach((path) => {
      revalidatePath(path)
    })

    return doc
  }
}

/**
 * Creates the afterChange hook for a global
 */
function createGlobalAfterChangeHook(slug: string) {
  return async ({ doc }: { doc: Record<string, unknown> }) => {
    const tags = GLOBAL_CACHE_MAP[slug] || []

    // Revalidate tags
    tags.forEach((tag) => {
      revalidateTag(tag)
    })

    // Always revalidate homepage for globals
    revalidatePath('/')

    return doc
  }
}

/**
 * Revalidation Plugin
 *
 * Automatically adds afterChange and afterDelete hooks to all collections
 * and globals to invalidate Next.js cache when content changes.
 */
export const revalidationPlugin: Plugin = (incomingConfig: Config): Config => {
  // Add hooks to collections
  const collections = incomingConfig.collections?.map((collection): CollectionConfig => {
    // Skip collections that don't need revalidation (like users, media)
    if (!COLLECTION_CACHE_MAP[collection.slug]) {
      return collection
    }

    const afterChangeHook = createCollectionAfterChangeHook(collection.slug)
    const afterDeleteHook = createCollectionAfterDeleteHook(collection.slug)

    return {
      ...collection,
      hooks: {
        ...collection.hooks,
        afterChange: [
          ...(collection.hooks?.afterChange || []),
          afterChangeHook,
        ],
        afterDelete: [
          ...(collection.hooks?.afterDelete || []),
          afterDeleteHook,
        ],
      },
    }
  })

  // Add hooks to globals
  const globals = incomingConfig.globals?.map((global): GlobalConfig => {
    // Skip globals that don't need revalidation
    if (!GLOBAL_CACHE_MAP[global.slug]) {
      return global
    }

    const afterChangeHook = createGlobalAfterChangeHook(global.slug)

    return {
      ...global,
      hooks: {
        ...global.hooks,
        afterChange: [
          ...(global.hooks?.afterChange || []),
          afterChangeHook,
        ],
      },
    }
  })

  return {
    ...incomingConfig,
    collections,
    globals,
  }
}
