/**
 * Shape of the public Payload queries in lib/utils/payload-api.ts.
 *
 * - Catalog/menu queries must not serialize unbounded reviews or 3D label
 *   uploads. Next.js `unstable_cache` throws in dev (and skips in prod) when an
 *   entry exceeds 2MB — the full beers find crossed that on /beer.
 * - Every public fetcher reads as an anonymous visitor: Payload 3.x defaults
 *   `overrideAccess` to true, so each call must pass `overrideAccess: false`
 *   for collection and field access rules to apply.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Passes the cached function straight through, recording the cache options.
const unstableCache = vi.hoisted(() =>
  vi.fn((fn: (...args: unknown[]) => unknown, _key?: unknown, _options?: unknown) => fn),
)
vi.mock('next/cache', () => ({
  unstable_cache: unstableCache,
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const find = vi.fn()
const findGlobal = vi.fn()
vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ find, findGlobal })),
}))
vi.mock('@/src/payload.config', () => ({ default: {} }))

// One scheduled vendor so getCombinedUpcomingFood reaches its food-vendors find.
vi.mock('@/src/utils/recurring-food', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/utils/recurring-food')>()),
  getRecurringFoodState: vi.fn(async (_payload: unknown, { year }: { year: number }) => ({
    year,
    schedules: { 'loc-1': { monday: { first: 'vendor-1' } } },
    exclusions: {},
    usingLegacyData: false,
  })),
}))

import {
  fetchGlobal,
  getActiveFAQs,
  getAllBeersFromPayload,
  getAllDistributorsGeoJSON,
  getAllLocations,
  getAllUpcomingEventsFromPayload,
  getAvailableBeersFromMenus,
  getBeerBySlug,
  getCombinedUpcomingFood,
  getComingSoonBeers,
  getMenuByUrl,
  getMenuByUrlFresh,
  getMenusByLocation,
  getUpcomingEventsFromPayload,
  getUpcomingFoodFromPayload,
  getWeeklyHoursWithHolidays,
  hasAnyBeerJustReleased,
} from '@/lib/utils/payload-api'

beforeEach(() => {
  find.mockReset()
  findGlobal.mockReset()
})

function beersQuery() {
  return find.mock.calls.map((call) => call[0] as Record<string, unknown>).find(
    (args) => args.collection === 'beers',
  )
}

function menusQuery() {
  return find.mock.calls.map((call) => call[0] as Record<string, unknown>).find(
    (args) => args.collection === 'menus',
  )
}

describe('Payload query shape for cacheable beer lists', () => {
  it('getAllBeersFromPayload drops the reviews join and 3D label uploads', async () => {
    find.mockResolvedValue({ docs: [] })
    await getAllBeersFromPayload()

    const query = beersQuery()
    expect(query).toBeTruthy()
    expect(query?.joins).toBe(false)

    const select = query?.select as Record<string, boolean> | undefined
    expect(select?.name).toBe(true)
    expect(select?.slug).toBe(true)
    expect(select?.image).toBe(true)
    expect(select?.positiveReviews).toBeUndefined()
    expect(select?.reviews).toBeUndefined()
    expect(select?.labelBase).toBeUndefined()
    expect(select?.labelMetalness).toBeUndefined()
    expect(select?.labelVideo).toBeUndefined()
    const populate = query?.populate as { styles?: { name?: boolean }; media?: { url?: boolean } }
    expect(populate?.styles?.name).toBe(true)
    expect(populate?.media?.url).toBe(true)
  })

  it('getMenusByLocation populates beers without positiveReviews', async () => {
    find.mockImplementation(async (args: { collection: string }) => {
      if (args.collection === 'locations') {
        return { docs: [{ id: 'loc-1', slug: 'lawrenceville' }] }
      }
      return { docs: [] }
    })
    await getMenusByLocation('lawrenceville')

    const query = menusQuery()
    const populate = query?.populate as { beers?: Record<string, boolean> } | undefined
    expect(populate?.beers?.name).toBe(true)
    expect(populate?.beers?.canSingle).toBe(true)
    expect(populate?.beers?.positiveReviews).toBeUndefined()
    expect(populate?.beers?.labelBase).toBeUndefined()
  })

  it('getAvailableBeersFromMenus uses the same narrowed menu populate', async () => {
    find.mockResolvedValue({ docs: [] })
    await getAvailableBeersFromMenus()

    const query = menusQuery()
    const populate = query?.populate as { beers?: Record<string, boolean> } | undefined
    expect(populate?.beers?.name).toBe(true)
    expect(populate?.beers?.positiveReviews).toBeUndefined()
  })
})

describe('public fetchers read as an anonymous visitor', () => {
  // Every Local API call a fetcher makes, with the collections/globals it hit.
  function localApiCalls() {
    return [...find.mock.calls, ...findGlobal.mock.calls].map(
      (call) => call[0] as Record<string, unknown>,
    )
  }

  it.each<[string, () => Promise<unknown>, string[]]>([
    ['hasAnyBeerJustReleased', () => hasAnyBeerJustReleased(), ['beers']],
    ['getAllBeersFromPayload', () => getAllBeersFromPayload(), ['beers']],
    ['getMenusByLocation', () => getMenusByLocation('lawrenceville'), ['locations', 'menus']],
    ['getMenuByUrl', () => getMenuByUrl('lawrenceville-draft'), ['menus']],
    ['getMenuByUrlFresh', () => getMenuByUrlFresh('lawrenceville-draft'), ['menus']],
    ['getAllLocations', () => getAllLocations(), ['locations']],
    ['getAvailableBeersFromMenus', () => getAvailableBeersFromMenus(), ['menus']],
    ['getComingSoonBeers', () => getComingSoonBeers(), ['coming-soon']],
    ['fetchGlobal', () => fetchGlobal('site-content'), ['site-content']],
    [
      'getWeeklyHoursWithHolidays',
      () => getWeeklyHoursWithHolidays('loc-1'),
      ['locations', 'holiday-hours'],
    ],
    [
      'getUpcomingEventsFromPayload',
      () => getUpcomingEventsFromPayload('lawrenceville'),
      ['locations', 'events', 'recurring-events'],
    ],
    [
      'getAllUpcomingEventsFromPayload',
      () => getAllUpcomingEventsFromPayload(),
      ['events', 'recurring-events'],
    ],
    [
      'getUpcomingFoodFromPayload',
      () => getUpcomingFoodFromPayload('lawrenceville'),
      ['locations', 'food'],
    ],
    [
      'getCombinedUpcomingFood',
      () => getCombinedUpcomingFood('lawrenceville'),
      ['locations', 'food', 'food-vendors'],
    ],
    ['getAllDistributorsGeoJSON', () => getAllDistributorsGeoJSON(), ['distributors']],
    ['getActiveFAQs', () => getActiveFAQs(), ['faqs']],
  ])('%s passes overrideAccess: false on every call', async (_name, run, targets) => {
    find.mockImplementation(async (args: { collection: string }) =>
      args.collection === 'locations'
        ? { docs: [{ id: 'loc-1', slug: 'lawrenceville', timezone: 'America/New_York' }] }
        : { docs: [] },
    )
    findGlobal.mockResolvedValue({ beers: [] })

    await run()

    const calls = localApiCalls()
    const hit = new Set(calls.map((args) => (args.collection ?? args.slug) as string))
    expect([...hit].sort()).toEqual([...targets].sort())
    for (const args of calls) {
      expect(args, String(args.collection ?? args.slug)).toMatchObject({ overrideAccess: false })
    }
  })
})

describe('getBeerBySlug reads as an anonymous visitor', () => {
  it('returns null for a draft beer (access hides it) so the page 404s', async () => {
    // canReadBeers limits anonymous reads to published beers, so a draft slug
    // comes back with no docs.
    find.mockResolvedValue({ docs: [] })

    await expect(getBeerBySlug('draft-beer')).resolves.toBeNull()

    expect(find).toHaveBeenCalledTimes(1)
    expect(find.mock.calls[0][0]).toMatchObject({ collection: 'beers', overrideAccess: false })
  })

  it('serves only beer-reviews docs, never the legacy positiveReviews JSON', async () => {
    const legacy = [{ username: 'Old', url: 'https://untappd.com/checkin/legacy' }]
    find.mockImplementation(async (args: { collection: string }) =>
      args.collection === 'beers'
        ? { docs: [{ id: 'beer-1', slug: 'published-beer', positiveReviews: legacy }] }
        : { docs: [] },
    )

    const beer = await getBeerBySlug('published-beer')

    expect(beer?.positiveReviews).toEqual([])
    const calls = find.mock.calls.map((call) => call[0] as Record<string, unknown>)
    expect(calls.map((args) => args.collection)).toEqual(['beers', 'beer-reviews'])
    for (const args of calls) {
      expect(args, String(args.collection)).toMatchObject({ overrideAccess: false })
    }
  })
})

describe('menu data cache', () => {
  it('keeps a menu until its tags are invalidated, with a one-hour fallback', async () => {
    unstableCache.mockClear()
    await getMenuByUrl('l-draft').catch(() => null)

    expect(unstableCache).toHaveBeenCalledWith(expect.any(Function), ['menu-url-l-draft'], {
      tags: ['menus', 'menu-l-draft'],
      revalidate: 3600,
    })
  })
})
