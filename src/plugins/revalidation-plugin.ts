/**
 * Payload CMS Revalidation Plugin
 *
 * Automatically adds cache revalidation hooks to all collections and globals.
 * When content changes in Payload, the relevant Next.js cache tags are invalidated,
 * ensuring the frontend serves fresh data on the next request.
 *
 * IMPORTANT: Only register afterChange/afterDelete hooks here — never afterRead.
 * Payload's admin form-state requests (stale-data check, document locking,
 * relationship population) read docs through Next.js Server Actions, and calling
 * revalidateTag/revalidatePath inside a Server Action forces the admin router to
 * refetch the page — resetting the edit form mid-edit.
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { after } from 'next/server'
import type { Config, Plugin, CollectionConfig, GlobalConfig, PayloadRequest } from 'payload'

import { publishKioskInvalidate } from '@/lib/ably/publish'
import { CACHE_TAGS } from '@/lib/utils/cache'
import { isDraftOnlySave } from '@/src/utils/draft-save'

// Collection to cache tags mapping
// Defines which tags should be invalidated when a collection changes
const COLLECTION_CACHE_MAP: Record<string, string[]> = {
  // Beer edits do NOT fire the broad 'menus' tag: Beers.afterChange
  // (revalidateMenusForBeer) invalidates the precise `menu-${url}` tags of the
  // menus that actually contain the beer. Caches that embed beer docs inside
  // menu queries subscribe to 'beers' directly (see lib/utils/payload-api.ts).
  beers: ['beers'],
  'beer-reviews': ['beers'],
  menus: ['menus', CACHE_TAGS.kioskMenus], // kioskMenus: see KIOSK_FRESH_TAGS
  events: ['events'],
  'recurring-events': ['events'],
  food: ['food'],
  locations: ['locations', 'menus', CACHE_TAGS.kioskMenus], // Locations affect menus
  styles: ['styles', 'beers'], // Styles affect beer displays
  distributors: ['distributors'],
  'food-vendors': ['food-vendors', 'food'], // Food vendors affect food displays
  'recurring-food-schedules': ['recurring-food', 'food'],
  'recurring-food-exclusions': ['recurring-food', 'food'],
  products: ['products', 'menus', CACHE_TAGS.kioskMenus], // Products affect menu displays
  'holiday-hours': ['holiday-hours', 'locations'],
  faqs: ['faqs'],
  jobs: ['jobs'],
  'job-applications': [],
}

// Global to cache tags mapping
const GLOBAL_CACHE_MAP: Record<string, string[]> = {
  'coming-soon': ['coming-soon'],
  'site-content': ['site-content'],
  'site-seo': ['site-seo'],
  'recurring-food': ['recurring-food', 'food'],
}

// Globals that feed every page's metadata (title template, default OG image, hub meta and
// intros). Tag invalidation alone leaves the ISR/static pages stale, so these revalidate the
// whole route tree.
const SITE_WIDE_GLOBALS = new Set(['site-seo'])

// Paths to revalidate for each collection
const COLLECTION_PATHS: Record<string, string[]> = {
  beers: ['/', '/beer'],
  'beer-reviews': ['/', '/beer'],
  menus: ['/'],
  events: ['/', '/events'],
  'recurring-events': ['/', '/events'],
  food: ['/', '/food'],
  locations: ['/'],
  styles: ['/beer'],
  distributors: ['/beer-map'],
  'food-vendors': ['/food'],
  'recurring-food-schedules': ['/', '/food'],
  'recurring-food-exclusions': ['/', '/food'],
  products: ['/'],
  'holiday-hours': ['/'],
  faqs: ['/faq'],
  jobs: ['/jobs'],
}

// Nested route trees that need layout invalidation (every /e/[location] page
// embeds recurring food via getCombinedUpcomingFood).
const COLLECTION_LAYOUT_PATHS: Record<string, string[]> = {
  'recurring-events': ['/e'],
  'recurring-food-schedules': ['/e'],
  'recurring-food-exclusions': ['/e'],
}

// Dynamic path builders for collections with slugs
const COLLECTION_PATH_BUILDERS: Record<string, (doc: Record<string, unknown>) => string[]> = {
  beers: (doc) => (doc.slug ? [`/beer/${doc.slug}`] : []),
  locations: (doc) => (doc.slug ? [`/${doc.slug}`] : []),
  menus: (doc) => (doc.url ? [`/m/${doc.url}`] : []),
  jobs: (doc) => {
    const paths: string[] = []
    if (typeof doc.slug === 'string' && doc.slug) paths.push(`/jobs/${doc.slug}`)
    const locationSlug = locationSlugFromDoc(doc)
    if (locationSlug) paths.push(`/${locationSlug}`)
    return paths
  },
}

// Extra invalidation that only whole-collection batch runs need, so a
// per-document hook doesn't pay for it. A single write already fires its own
// `COLLECTION_PATH_BUILDERS` path and Beers.afterChange's precise
// `menu-${url}` tags; a batch writer passes `context.skipRevalidate`, which
// skips both, and has no doc to build a path from.
const COLLECTION_BATCH_EXTRAS: Record<
  string,
  { tags?: string[]; paths?: Array<[string, 'page' | 'layout']> }
> = {
  beers: {
    // getMenuByUrl reads 'menus' and 'kiosk-menus', not 'beers'; a batch skips
    // the per-menu tags Beers.afterChange would have expired.
    tags: ['menus', CACHE_TAGS.kioskMenus],
    // `/beer/[variant]` is a 3600s ISR route; invalidating the dynamic segment
    // covers every beer page in one call, which is what a catalogue-wide batch
    // wants anyway. Tag invalidation alone would leave them an hour stale.
    paths: [['/beer/[variant]', 'page']],
  },
}

/** Location slug from a `location` relationship that is already populated. */
function locationSlugFromDoc(doc: Record<string, unknown>): string | undefined {
  const location = doc.location
  if (location && typeof location === 'object' && 'slug' in location) {
    const slug = (location as { slug?: unknown }).slug
    if (typeof slug === 'string' && slug) return slug
  }
  return undefined
}

/**
 * Slug of a doc's `location`. A save hook usually gets the bare id, so it is
 * looked up inside the save's transaction. Undefined when the doc has no
 * location or the lookup fails, which callers turn into a refresh of every
 * display rather than a push that might miss one.
 */
async function resolveLocationSlug(
  doc: Record<string, unknown>,
  req: PayloadRequest,
): Promise<string | undefined> {
  const populated = locationSlugFromDoc(doc)
  if (populated) return populated

  const id = doc.location
  if (typeof id !== 'string' && typeof id !== 'number') return undefined
  try {
    const location = await req.payload.findByID({
      collection: 'locations',
      id,
      depth: 0,
      select: { slug: true },
      // eslint-disable-next-line no-restricted-syntax -- system: scoping a kiosk push is derived state; the editor's locations read can be limited to their own locations
      overrideAccess: true,
      req,
    })
    return location.slug || undefined
  } catch {
    return undefined
  }
}

// Collections whose docs carry a single `location` relationship and feed the
// events kiosk stream. Food is deliberately absent: the events kiosk gets food
// only as a server-rendered prop, so food saves never change a stream response.
const LOCATION_SCOPED_KIOSK_SLUGS = new Set(['events', 'recurring-events'])

/**
 * Publish Ably invalidate signals for collections that drive kiosk TVs.
 * `keys` scope a push to the displays showing that menu url or location slug;
 * none refreshes every display on the channel. Never throws into the CMS save.
 */
async function publishKioskSignal(
  slug: string,
  doc?: Record<string, unknown>,
  req?: PayloadRequest,
): Promise<void> {
  const scope = (key?: string) => (key ? [key] : undefined)
  if (slug === 'menus') {
    void publishKioskInvalidate({
      kind: 'menu',
      keys: scope(typeof doc?.url === 'string' ? doc.url : undefined),
    })
    return
  }
  if (LOCATION_SCOPED_KIOSK_SLUGS.has(slug)) {
    // No doc or req (a whole-collection batch): nothing to resolve, refresh all.
    const location = doc && req ? await resolveLocationSlug(doc, req) : undefined
    void publishKioskInvalidate({ kind: 'events', keys: scope(location) })
    return
  }
  // Location edits (hours, lines cleaned) feed menu displays that embed them.
  // No events push: that stream carries only the location name and its
  // 'locations' cache is just marked stale, so a push would refetch stale data.
  if (slug === 'locations') void publishKioskInvalidate({ kind: 'menu' })
}

function invalidateCollection(slug: string, doc?: Record<string, unknown>): void {
  ;(COLLECTION_CACHE_MAP[slug] || []).forEach(revalidateCollectionTag)
  ;(COLLECTION_PATHS[slug] || []).forEach((path) => revalidatePath(path))
  ;(COLLECTION_LAYOUT_PATHS[slug] || []).forEach((path) => revalidatePath(path, 'layout'))
  if (doc) {
    const pathBuilder = COLLECTION_PATH_BUILDERS[slug]
    if (pathBuilder) {
      pathBuilder(doc).forEach((path) => revalidatePath(path))
    }
  }
}

// Tags the kiosk stream responses carry, hard-expired so a cached read after a
// save is fresh rather than stale-while-revalidate. The expiry is queued, not
// awaited, so the Ably push can still beat it: menu displays therefore refetch
// on a push from the uncached /api/menu-stream/[url]/fresh. 'menus' and
// 'locations' are deliberately absent: public pages share them, and hard
// expiry would make the next visitor to each wait for a synchronous rebuild
// (CACHE_TAGS.kioskMenus exists to avoid that for menus).
// 'events' is shared with public events pages too; that cost is accepted because
// event saves are rare and the events stream has no kiosk-only tag yet.
const KIOSK_FRESH_TAGS = new Set<string>([CACHE_TAGS.kioskMenus, CACHE_TAGS.events])

function revalidateCollectionTag(tag: string): void {
  // Kiosk caches return fresh data on the first read after a save, rather than
  // stale data followed by a background refresh.
  revalidateTag(tag, KIOSK_FRESH_TAGS.has(tag) ? { expire: 0 } : 'max')
}

/**
 * Invalidate every tag and path a whole-collection batch needs — the static
 * map plus `COLLECTION_BATCH_EXTRAS`. For callers outside the hook system
 * (the cron runner, the sheet sync) that write with `skipRevalidate` and
 * revalidate once afterwards, so the route and tag shapes stay single-sourced
 * here rather than being hand-rolled per caller.
 */
/**
 * `revalidateForCollection` once the current response has finished, for writers
 * that stream (the distributor importers): inside a stream the request context is
 * gone and Next's cache APIs throw "static generation store missing". `after` runs
 * the refresh once the stream closes, with the request context. `shouldRun` is read
 * then, so the caller can decide from the final counts. Outside a Next request
 * (unit tests, the Payload CLI) there is nothing to refresh, so it does nothing.
 */
export function revalidateForCollectionAfterResponse(slug: string, shouldRun: () => boolean): void {
  try {
    after(() => {
      if (shouldRun()) revalidateForCollection(slug)
    })
  } catch {
    // `after` throws outside a request scope; no page cache to refresh there
  }
}

export function revalidateForCollection(slug: string): void {
  invalidateCollection(slug)
  // No doc, so no keys: refresh every display on the affected kiosk channels.
  void publishKioskSignal(slug)

  const extras = COLLECTION_BATCH_EXTRAS[slug]
  if (!extras) return
  extras.tags?.forEach(revalidateCollectionTag)
  extras.paths?.forEach(([path, type]) => revalidatePath(path, type))
}

/**
 * Creates the afterChange hook for a collection.
 *
 * Bulk writers (the Untappd cron, sheet sync) pass
 * `context: { skipRevalidate: true }` so a 500-document loop doesn't fire
 * this fan-out per write — they revalidate once after the loop instead.
 *
 * Draft-only saves (Save Draft, autosave) skip everything: public pages and
 * kiosks read published documents only, so nothing they show has changed.
 */
function createCollectionAfterChangeHook(slug: string) {
  return async ({
    doc,
    req,
    context,
  }: {
    doc: Record<string, unknown>
    req?: PayloadRequest
    context?: Record<string, unknown>
  }) => {
    if (context?.skipRevalidate || isDraftOnlySave(doc, req)) {
      return doc
    }
    invalidateCollection(slug, doc)
    // Optional Ably push so kiosk TVs poll immediately. No-op when ABLY_API_KEY
    // is unset. May do one location lookup to scope the push; never fails the
    // CMS write.
    await publishKioskSignal(slug, doc, req)
    return doc
  }
}

/**
 * Creates the afterDelete hook for a collection
 */
function createCollectionAfterDeleteHook(slug: string) {
  return async ({
    doc,
    req,
    context,
  }: {
    doc: Record<string, unknown>
    req?: PayloadRequest
    context?: Record<string, unknown>
  }) => {
    if (context?.skipRevalidate) {
      return doc
    }
    invalidateCollection(slug, doc)
    await publishKioskSignal(slug, doc, req)
    return doc
  }
}

/**
 * Creates the afterChange hook for a global.
 *
 * Honors `context: { skipRevalidate: true }` like the collection hooks do —
 * scripts and bulk writers run outside a Next.js request, where
 * revalidateTag/revalidatePath throw ("static generation store missing").
 */
function createGlobalAfterChangeHook(slug: string) {
  return async ({
    doc,
    context,
  }: {
    doc: Record<string, unknown>
    context?: Record<string, unknown>
  }) => {
    if (context?.skipRevalidate) {
      return doc
    }
    const tags = GLOBAL_CACHE_MAP[slug] || []

    // Revalidate tags
    tags.forEach((tag) => {
      revalidateTag(tag, 'max')
    })

    if (SITE_WIDE_GLOBALS.has(slug)) {
      revalidatePath('/', 'layout')
    } else {
      // Always revalidate homepage for globals
      revalidatePath('/')
    }

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
        afterChange: [...(collection.hooks?.afterChange || []), afterChangeHook],
        afterDelete: [...(collection.hooks?.afterDelete || []), afterDeleteHook],
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
        afterChange: [...(global.hooks?.afterChange || []), afterChangeHook],
      },
    }
  })

  return {
    ...incomingConfig,
    collections,
    globals,
  }
}
