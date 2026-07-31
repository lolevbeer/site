/**
 * Untappd cron de-amplification (docs/plans/perf-simplification.md Task 12):
 * - a beer whose fetched rating/count/reviews match the stored doc produces
 *   NO payload.update (so no hooks, no revalidation at all)
 * - a changed beer updates with context.skipRevalidate so the revalidation
 *   plugin's per-write fan-out is suppressed
 * - the run fires exactly ONE batched invalidation (tag 'beers' + 2 paths)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const find = vi.fn()
const update = vi.fn()
vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ find, update })),
}))
vi.mock('@/src/payload.config', () => ({ default: {} }))

const revalidateTag = vi.fn()
const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}))

const fetchUntappdData = vi.fn()
vi.mock('@/src/utils/untappd', () => ({
  fetchUntappdData: (...args: unknown[]) => fetchUntappdData(...args),
  isCircuitOpen: () => false,
  resetCircuit: () => {},
}))

vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { NextRequest } from 'next/server'
import { GET } from '@/src/app/api/cron/sync-untappd/route'

const cronRequest = () =>
  new NextRequest('http://localhost/api/cron/sync-untappd', {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  })

beforeEach(() => {
  process.env.CRON_SECRET = 'test-secret'
  find.mockReset()
  update.mockReset()
  revalidateTag.mockReset()
  revalidatePath.mockReset()
  fetchUntappdData.mockReset()
})

describe('sync-untappd cron batching', () => {
  it('skips unchanged beers, updates changed ones with skipRevalidate, one batched invalidation', async () => {
    find.mockResolvedValue({
      docs: [
        // Unchanged: stored values match what Untappd returns
        {
          id: 'b1',
          name: 'Unchanged',
          untappd: 'https://untappd.com/b/unchanged',
          untappdRating: 4.0,
          untappdRatingCount: 100,
          positiveReviews: [],
        },
        // Changed: stored rating differs
        {
          id: 'b2',
          name: 'Changed',
          untappd: 'https://untappd.com/b/changed',
          untappdRating: 3.5,
          untappdRatingCount: 100,
          positiveReviews: [],
        },
      ],
    })
    fetchUntappdData.mockResolvedValue({ rating: 4.0, ratingCount: 100, positiveReviews: [] })
    update.mockResolvedValue({})

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(body.results).toMatchObject({ updated: 1, skipped: 1, errors: 0 })
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b2', context: { skipRevalidate: true } }),
    )
    // One batched invalidation for the whole run
    expect(revalidateTag).toHaveBeenCalledTimes(1)
    expect(revalidateTag).toHaveBeenCalledWith('beers')
    expect(revalidatePath.mock.calls.map((c) => c[0]).sort()).toEqual(['/', '/beer'])
  }, 15000)

  it('fires no invalidation when nothing changed', async () => {
    find.mockResolvedValue({
      docs: [
        {
          id: 'b1',
          name: 'Unchanged',
          untappd: 'https://untappd.com/b/unchanged',
          untappdRating: 4.0,
          untappdRatingCount: 100,
          positiveReviews: [],
        },
      ],
    })
    fetchUntappdData.mockResolvedValue({ rating: 4.0, ratingCount: 100, positiveReviews: [] })

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(body.results).toMatchObject({ updated: 0, skipped: 1 })
    expect(update).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  }, 15000)
})
