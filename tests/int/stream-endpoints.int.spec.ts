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
  getAllLocations: vi.fn(),
  getUpcomingEventsFromPayload: vi.fn(),
  transformPayloadEventToBreweryEvent: vi.fn((event: { id: string }) => ({ id: event.id })),
}))

vi.mock('@/lib/utils/payload-api', () => api)
vi.mock('@/lib/utils/logger', () => ({ logger: { error: vi.fn() } }))

import * as menuStream from '@/src/app/api/menu-stream/[url]/route'
import * as eventsStream from '@/src/app/api/events-stream/[location]/route'

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

  it('throws on a failed fetch so the last good cached menu keeps serving', async () => {
    api.getMenuByUrl.mockRejectedValue(new Error('db down'))
    await expect(menuStream.GET(request, params({ url: 'draft' }))).rejects.toThrow('db down')
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
