/**
 * The /m and /e display endpoints are cached on Vercel's CDN until content
 * changes: `force-static` with no prerendered params caches each URL on its
 * first request, the fetchers' cache tags let Payload edits invalidate it, and
 * a 10-minute fallback refresh bounds how stale a deployId can get. To stay
 * cacheable, a response must not depend on the clock, and a failed fetch must
 * throw (keeping the last good copy) rather than return an error to cache.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getMenuByUrl: vi.fn(),
  getMenuByUrlFresh: vi.fn(),
  getAllLocations: vi.fn(),
  getEventsForLocationFresh: vi.fn(),
  getUpcomingEventsFromPayload: vi.fn(),
  transformPayloadEventToBreweryEvent: vi.fn((event: { id: string }) => ({ id: event.id })),
}))

vi.mock('@/lib/utils/payload-api', () => api)

import * as menuStream from '@/src/app/api/menu-stream/[url]/route'
import * as menuStreamFresh from '@/src/app/api/menu-stream/[url]/fresh/route'
import * as eventsStream from '@/src/app/api/events-stream/[location]/route'
import * as eventsStreamFresh from '@/src/app/api/events-stream/[location]/fresh/route'

const params = <T>(value: T) => ({ params: Promise.resolve(value) })
const request = new Request('http://localhost/api') as never

beforeEach(() => {
  vi.clearAllMocks()
})

describe.each([
  ['menu-stream', menuStream],
  ['events-stream', eventsStream],
])('%s caching', (_name, route) => {
  it('is cached per URL on first request, refreshed at least every 10 minutes', async () => {
    expect(route.dynamic).toBe('force-static')
    expect(route.revalidate).toBe(600)
    expect(await route.generateStaticParams()).toEqual([])
  })
})

describe('menu-stream response', () => {
  it('has no clock-dependent fields; the timestamp comes from the menu and its items', async () => {
    api.getMenuByUrl.mockResolvedValue({
      updatedAt: '2026-09-01T00:00:00.000Z',
      themeMode: 'auto',
      items: [{ product: { value: { updatedAt: '2026-09-20T00:00:00.000Z' } } }],
    })

    const body = await (await menuStream.GET(request, params({ url: 'draft' }))).json()

    expect(Object.keys(body).sort()).toEqual(['deployId', 'menu', 'timestamp'])
    expect(body.timestamp).toBe(Date.parse('2026-09-20T00:00:00.000Z'))
  })

  it('changes the polling timestamp when only the location cleaning date is updated', async () => {
    const menu = {
      updatedAt: '2026-09-20T00:00:00.000Z',
      items: [],
      location: {
        linesLastCleaned: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    }
    api.getMenuByUrl.mockResolvedValue(menu)
    const before = await (await menuStream.GET(request, params({ url: 'draft' }))).json()

    // Backdating a cleaning still needs to reach displays: use updatedAt.
    menu.location = {
      linesLastCleaned: '2026-09-19T00:00:00.000Z',
      updatedAt: '2026-09-28T00:00:00.000Z',
    }
    const after = await (await menuStream.GET(request, params({ url: 'draft' }))).json()

    expect(after.timestamp).not.toBe(before.timestamp)
    expect(after.timestamp).toBe(Date.parse(menu.location.updatedAt))
    expect(after.menu.location.linesLastCleaned).toBe(menu.location.linesLastCleaned)
  })

  it('throws on a failed fetch so the last good cached menu keeps serving', async () => {
    api.getMenuByUrl.mockRejectedValue(new Error('db down'))
    await expect(menuStream.GET(request, params({ url: 'draft' }))).rejects.toThrow('db down')
  })
})

/**
 * The Ably-triggered refetch reads the menu straight from the database, not through the
 * tagged cache, because Next starts the tag flush and the after() publish together and
 * the cache can still serve the previous menu when the display's fetch arrives.
 */
describe('menu-stream fresh response', () => {
  const menu = {
    id: 'm1',
    url: 'draft',
    updatedAt: '2026-09-01T00:00:00.000Z',
    themeMode: 'auto',
    location: { updatedAt: '2026-09-10T00:00:00.000Z' },
    items: [{ product: { value: { updatedAt: '2026-09-20T00:00:00.000Z' } } }],
  }

  it('is dynamic and never stored by the CDN or browser', async () => {
    api.getMenuByUrlFresh.mockResolvedValue(menu)
    expect(menuStreamFresh.dynamic).toBe('force-dynamic')

    const response = await menuStreamFresh.GET(request, params({ url: 'draft' }))

    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('reads the uncached menu and answers in the same shape as the cached endpoint', async () => {
    api.getMenuByUrlFresh.mockResolvedValue(menu)
    api.getMenuByUrl.mockResolvedValue(menu)

    const fresh = await (await menuStreamFresh.GET(request, params({ url: 'draft' }))).json()
    const cached = await (await menuStream.GET(request, params({ url: 'draft' }))).json()

    expect(api.getMenuByUrlFresh).toHaveBeenCalledWith('draft')
    expect(fresh).toEqual(cached)
    expect(fresh.timestamp).toBe(Date.parse('2026-09-20T00:00:00.000Z'))
  })

  it('answers 404 for a missing menu and throws on a failed fetch', async () => {
    api.getMenuByUrlFresh.mockResolvedValueOnce(null)
    expect((await menuStreamFresh.GET(request, params({ url: 'nope' }))).status).toBe(404)

    api.getMenuByUrlFresh.mockRejectedValueOnce(new Error('db down'))
    await expect(menuStreamFresh.GET(request, params({ url: 'draft' }))).rejects.toThrow('db down')
  })
})

describe('events-stream response', () => {
  beforeEach(() => {
    api.getAllLocations.mockResolvedValue([{ slug: 'lawrenceville', name: 'Lawrenceville' }])
  })

  it('has no clock-dependent fields; with no events the timestamp is a stable 0', async () => {
    api.getUpcomingEventsFromPayload.mockResolvedValue([])

    const body = await (
      await eventsStream.GET(request, params({ location: 'lawrenceville' }))
    ).json()

    expect(Object.keys(body).sort()).toEqual(['deployId', 'events', 'locationName', 'timestamp'])
    expect(body.timestamp).toBe(0)
  })

  it('throws on a failed fetch so the last good cached events keep serving', async () => {
    api.getUpcomingEventsFromPayload.mockRejectedValue(new Error('db down'))
    await expect(eventsStream.GET(request, params({ location: 'lawrenceville' }))).rejects.toThrow(
      'db down',
    )
  })
})

it('pushed events bypass both the location and event caches', async () => {
  api.getEventsForLocationFresh.mockResolvedValue({
    location: { slug: 'lawrenceville', name: 'Renamed' },
    events: [],
  })
  const response = await eventsStreamFresh.GET(request, params({ location: 'Lawrenceville' }))
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toMatchObject({ events: [], locationName: 'Renamed', timestamp: 0 })
  expect(api.getEventsForLocationFresh).toHaveBeenCalledWith('lawrenceville')
  expect(api.getAllLocations).not.toHaveBeenCalled()
})
