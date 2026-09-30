/**
 * Evidence for why the Ably-triggered refetch reads /api/menu-stream/[url]/fresh (uncached):
 * a display that refetches through the TAGGED cache on the "menu updated" push gets the
 * previous menu (prod /m/l-draft showed the event before the content change).
 *
 * This runs the real production `publishKioskInvalidate` (Ably transport mocked) and the
 * real `revalidateTag` from next/cache, inside real Next internals: `AfterContext`,
 * `workAsyncStorage`, `executeRevalidates` and `unstable_cache`. Only the following are
 * synthetic: the incremental cache (its `revalidateTag` flush is delayed, as a remote
 * cache handler's is), the committed menu versions, and the request lifecycle (handler
 * returns -> pending revalidates start -> response closes -> after() callbacks run), which
 * mirrors app-route/module.js `resolvePendingRevalidations` + AfterContext.onClose.
 * No database, env file or Ably connection is used. Next internals are imported here in
 * the fixture only, never from production code.
 *
 * EXPECTED STATE: GREEN, asserting the stale timing. The first push-triggered fetch
 * through the tagged cache returns the previous version because the tag flush is still
 * pending when the after() publish fires. If Next ever orders these differently this
 * test fails, which means the /fresh route is no longer needed. The route's own tests
 * are in stream-endpoints.int.spec.ts and ably-kiosk.int.spec.ts.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Ably transport mock: the publish call is where a real display would start fetching.
const ably = vi.hoisted(() => {
  const state = { onPublish: async (): Promise<void> => undefined }
  const publish = vi.fn(async () => {
    await state.onPublish()
  })
  const Rest = vi.fn(function MockRest() {
    return { channels: { get: () => ({ publish }) } }
  })
  return { state, publish, Rest }
})
vi.mock('ably', () => ({ default: { Rest: ably.Rest } }))

// The Next server sets this global before loading its async-storage modules.
;(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage

// Plain CJS requires so we share the exact module instances next/cache and next/server use.
const nodeRequire = createRequire(import.meta.url)
const { workAsyncStorage } = nodeRequire('next/dist/server/app-render/work-async-storage.external')
const { workUnitAsyncStorage } = nodeRequire(
  'next/dist/server/app-render/work-unit-async-storage.external',
)
const { AfterContext } = nodeRequire('next/dist/server/after/after-context')
const { executeRevalidates } = nodeRequire('next/dist/server/revalidation-utils')
const { unstable_cache } = nodeRequire('next/dist/server/web/spec-extension/unstable-cache')
const { revalidateTag } = nodeRequire('next/cache')

const MENU_URL = 'l-draft'
const MENU_TAG = `menu-${MENU_URL}`

interface Deferred {
  promise: Promise<void>
  resolve: () => void
}
const deferred = (): Deferred => {
  let resolve!: () => void
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}

/** Synthetic incremental cache: entries go stale only once a tag flush has completed. */
function createIncrementalCache(flushGate: Deferred) {
  const entries = new Map<string, { value: unknown; tags: string[]; at: number }>()
  const expired = new Map<string, number>()
  const cache = {
    isOnDemandRevalidate: false,
    async generateSimpleCacheKey(input: string) {
      return input
    },
    async get(key: string) {
      const entry = entries.get(key)
      if (!entry) return null
      const isStale = entry.tags.some((tag) => (expired.get(tag) ?? 0) >= entry.at)
      return { value: entry.value, isStale, lastModified: entry.at }
    },
    async set(key: string, value: unknown, ctx: { tags?: string[] }) {
      entries.set(key, { value, tags: ctx.tags ?? [], at: Date.now() })
    },
    // Delayed expiry: the flush is slow (remote handler), so the tag stays fresh meanwhile.
    async revalidateTag(tags: string[]) {
      await flushGate.promise
      for (const tag of tags) expired.set(tag, Date.now() + 1)
    },
  }
  return cache
}

describe('menu update freshness: Ably push vs tag flush', () => {
  let committedVersion = 1
  let flushGate: Deferred
  let incrementalCache: ReturnType<typeof createIncrementalCache>

  const workStoreFor = (afterContext: unknown) => ({
    route: '/api/save',
    page: '/api/save',
    incrementalCache,
    afterContext,
    isStaticGeneration: false,
    isDraftMode: false,
    isOnDemandRevalidate: false,
    fetchCache: undefined,
    nextFetchId: 1,
    cacheLifeProfiles: {},
    forceStatic: false,
  })
  const workUnitStoreFor = () => ({
    type: 'request',
    phase: 'action',
    url: new URL('http://localhost/api/save'),
    implicitTags: { tags: [], expirationsByCacheKind: new Map() },
  })

  // What the website's tagged menu reader does: unstable_cache keyed by url, tagged menu-<url>.
  const getMenuVersion = unstable_cache(async () => committedVersion, ['menu-by-url', MENU_URL], {
    tags: ['menus', 'kiosk-menus', MENU_TAG],
  })

  /** A display's fetch: its own request scope against the shared incremental cache. */
  const displayFetch = (): Promise<number> => {
    const afterContext = new AfterContext({
      waitUntil: () => undefined,
      onClose: () => undefined,
      onTaskError: undefined,
    })
    return workAsyncStorage.run(workStoreFor(afterContext), () =>
      workUnitAsyncStorage.run(workUnitStoreFor(), () => getMenuVersion()),
    )
  }

  beforeEach(() => {
    vi.stubEnv('ABLY_API_KEY', 'test.key:secret')
    committedVersion = 1
    flushGate = deferred()
    incrementalCache = createIncrementalCache(flushGate)
    ably.publish.mockClear()
  })
  afterEach(() => {
    flushGate.resolve()
    vi.unstubAllEnvs()
  })

  it('the first tagged-cache fetch after the menu push still returns the previous version', async () => {
    const { publishKioskInvalidate, resetAblyRestClientForTests } =
      await import('@/lib/ably/publish')
    resetAblyRestClientForTests()

    // A display already showed version 1, so it is in the tagged cache.
    expect(await displayFetch()).toBe(1)

    const firstFetchAfterPush: number[] = []
    ably.state.onPublish = async () => {
      // The display refetches the moment the push arrives. The tag flush is still pending.
      firstFetchAfterPush.push(await displayFetch())
      flushGate.resolve()
    }

    // The save: version 2 is committed, then the hook invalidates the tag and queues the push.
    committedVersion = 2
    const closeCallbacks: Array<() => void> = []
    const waitUntilPromises: Promise<unknown>[] = []
    const afterContext = new AfterContext({
      waitUntil: (p: Promise<unknown>) => waitUntilPromises.push(p),
      onClose: (cb: () => void) => closeCallbacks.push(cb),
      onTaskError: undefined,
    })
    const workStore = workStoreFor(afterContext)

    await workAsyncStorage.run(workStore, () =>
      workUnitAsyncStorage.run(workUnitStoreFor(), async () => {
        revalidateTag(MENU_TAG, { expire: 0 })
        await publishKioskInvalidate({ kind: 'menu', keys: [MENU_URL] })
      }),
    )

    // Handler returned: Next starts pending revalidates now (app-route/module.js
    // resolvePendingRevalidations), then the response closes and after() callbacks run.
    waitUntilPromises.push(executeRevalidates(workStore) as Promise<unknown>)
    for (const cb of closeCallbacks) cb()
    await Promise.all(waitUntilPromises)

    expect(ably.publish).toHaveBeenCalledTimes(1)
    // Stale: this is why the push refetch bypasses the cache (the /fresh route).
    expect(firstFetchAfterPush).toEqual([1])
  })
})
