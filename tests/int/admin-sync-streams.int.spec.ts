import { afterEach, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { syncUntappdRatings } from '@/src/endpoints/sync-untappd-ratings'
import { recalculateBeerPrices } from '@/src/endpoints/recalculate-beer-prices'

const { fetchUntappdData } = vi.hoisted(() => ({ fetchUntappdData: vi.fn() }))
vi.mock('@/src/utils/untappd', () => ({ fetchUntappdData }))

const user = { id: 'admin', roles: ['admin'] }
const review = { url: 'https://untappd.com/user/test/checkin/1', text: 'Great beer' }
const newReview = { ...review, url: 'https://untappd.com/user/test/checkin/2' }
const beerUrl = '/b/lolev-test/123'

function request(untappd: string, dryRun: boolean) {
  const payload = {
    find: vi.fn().mockResolvedValue({
      docs: [{ id: 'beer', name: 'Test', untappd, positiveReviews: [review] }],
    }),
    update: vi.fn().mockResolvedValue({}),
  }
  return {
    payload,
    req: {
      payload,
      user,
      url: `http://localhost/api/sync?dryRun=${dryRun}`,
    } as unknown as PayloadRequest,
  }
}

async function events(response: Response) {
  expect(response.headers.get('content-type')).toBe('text/event-stream')
  return (await response.text())
    .trim()
    .split('\n\n')
    .map((frame) => {
      const [event, data] = frame.split('\n')
      return { event: event.slice(7), data: JSON.parse(data.slice(6)) }
    })
}

afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})

it.each([
  ['', 'new'],
  ['invalid', 'updated'],
  [beerUrl, 'refreshed'],
])('syncs %j while preserving status %s, reviews, and user identity', async (untappd, status) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(`<p class="name"><a href="${beerUrl}">Test</a></p>`)),
  )
  fetchUntappdData.mockResolvedValue({
    rating: 4,
    ratingCount: 10,
    positiveReviews: [review, newReview],
  })
  const { req, payload } = request(untappd, false)
  const frames = await events(await syncUntappdRatings(req))
  expect(frames).toContainEqual({
    event: 'item',
    data: expect.objectContaining({ status, newReviews: 1 }),
  })
  expect(frames.at(-1)).toMatchObject({
    event: 'complete',
    data: { success: true, results: { errors: 0 } },
  })
  expect(payload.update).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      overrideAccess: false,
      user,
      data: expect.objectContaining({ untappdRating: 4, positiveReviews: [review, newReview] }),
    }),
  )
  if (untappd === beerUrl) expect(fetch).not.toHaveBeenCalled()
  else expect(payload.update.mock.calls[0][0].data.untappd).toBe(beerUrl)
})

it.each(['', 'invalid', beerUrl])('does not write during a dry run for %j', async (untappd) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(`<p class="name"><a href="${beerUrl}">Test</a></p>`)),
  )
  fetchUntappdData.mockResolvedValue({ rating: 4, ratingCount: 10, positiveReviews: [] })
  const { req, payload } = request(untappd, true)
  expect((await events(await syncUntappdRatings(req))).at(-1)).toMatchObject({
    data: { success: true, dryRun: true },
  })
  expect(payload.update).not.toHaveBeenCalled()
})

it.each([
  ['', 0],
  ['', 2],
  ['invalid', 0],
  ['invalid', 2],
])('skips %j when the search has %i matches', async (untappd, count) => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(`<p class="name"><a href="${beerUrl}">Test</a></p>`.repeat(count)),
      ),
  )
  const { req, payload } = request(untappd, false)
  const frames = await events(await syncUntappdRatings(req))
  expect(frames).toContainEqual({
    event: 'item',
    data: expect.objectContaining({ status: count ? 'multiple' : 'not-found' }),
  })
  expect(payload.update).not.toHaveBeenCalled()
  expect(fetchUntappdData).not.toHaveBeenCalled()
})

it.each([syncUntappdRatings, recalculateBeerPrices])(
  'closes the stream after a query failure',
  async (handler) => {
    const { req, payload } = request('', false)
    payload.find.mockRejectedValue(new Error('Database unavailable'))
    expect((await events(await handler(req))).at(-1)).toEqual({
      event: 'complete',
      data: { success: false, error: 'Database unavailable' },
    })
  },
)

it('preserves recalculation dry runs and half-pour exclusions', async () => {
  for (const dryRun of [true, false]) {
    const { req, payload } = request('', dryRun)
    payload.find.mockResolvedValue({
      docs: [
        { id: 'manual', halfPourOnly: true },
        { id: 'auto', draftPrice: 7, fourPack: 18 },
      ],
    })
    expect((await events(await recalculateBeerPrices(req))).at(-1)).toMatchObject({
      data: { success: true, dryRun, results: { updated: 1, skipped: 1, errors: 0 } },
    })
    expect(payload.update).toHaveBeenCalledTimes(dryRun ? 0 : 1)
  }
})
