/**
 * Payload Jobs Queue / Untappd batching:
 * - unchanged beers produce no writes
 * - changed beers suppress per-document revalidation
 * - the Vercel cron wakes the scheduled queue and invalidates once per job run
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

const find = vi.fn()
const update = vi.fn()
const handleSchedules = vi.fn()
const runJobs = vi.fn()

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    find,
    update,
    jobs: { handleSchedules, run: runJobs },
  })),
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
import { runUntappdRatingsSync, syncUntappdRatingsTask } from '@/src/jobs/sync-untappd-ratings'

const cronRequest = () =>
  new NextRequest('http://localhost/api/cron/sync-untappd', {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  })

const payload = { find, update } as unknown as Payload

const FAILED_UNTAPPD = {
  rating: null,
  ratingCount: null,
  positiveReviews: [],
  failed: true as const,
}

function beerDoc({
  id,
  name,
  untappd,
  untappdRating = 4,
  untappdRatingCount = 100,
}: {
  id: string
  name: string
  untappd: string
  untappdRating?: number | null
  untappdRatingCount?: number | null
}) {
  return {
    id,
    name,
    untappd,
    untappdRating,
    untappdRatingCount,
    positiveReviews: [],
  }
}

const RATE_LIMITED_BEER = beerDoc({
  id: 'b1',
  name: 'Rate limited',
  untappd: 'https://untappd.com/b/rate-limited',
})

async function runWithFakeTimers<T>(task: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync()
  return task
}

beforeEach(() => {
  process.env.CRON_SECRET = 'test-secret'
  find.mockReset()
  update.mockReset()
  handleSchedules.mockReset()
  runJobs.mockReset()
  revalidateTag.mockReset()
  revalidatePath.mockReset()
  fetchUntappdData.mockReset()
})

describe('sync-untappd job task', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('skips unchanged beers and updates changed ones with per-document revalidation disabled', async () => {
    find.mockResolvedValue({
      docs: [
        beerDoc({ id: 'b1', name: 'Unchanged', untappd: 'https://untappd.com/b/unchanged' }),
        beerDoc({
          id: 'b2',
          name: 'Changed',
          untappd: 'https://untappd.com/b/changed',
          untappdRating: 3.5,
        }),
      ],
    })
    fetchUntappdData.mockResolvedValue({ rating: 4, ratingCount: 100, positiveReviews: [] })
    update.mockResolvedValue({})

    await expect(runWithFakeTimers(runUntappdRatingsSync(payload))).resolves.toMatchObject({
      updated: 1,
      skipped: 1,
      errors: 0,
    })
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b2', context: { skipRevalidate: true } }),
    )
  })

  it('paces skipped beers as well as updated ones', async () => {
    // Every branch below the fetch must wait: a mostly-unchanged catalog would
    // otherwise be scraped in a tight burst and trip Untappd's rate limits.
    find.mockResolvedValue({
      docs: [
        beerDoc({ id: 'b1', name: 'Unchanged', untappd: 'https://untappd.com/b/unchanged' }),
        beerDoc({
          id: 'b2',
          name: 'No rating',
          untappd: 'https://untappd.com/b/no-rating',
          untappdRating: null,
          untappdRatingCount: null,
        }),
      ],
    })
    fetchUntappdData
      .mockResolvedValueOnce({ rating: 4, ratingCount: 100, positiveReviews: [] })
      .mockResolvedValueOnce({ rating: null, ratingCount: null, positiveReviews: [] })

    const started = Date.now()
    await expect(runWithFakeTimers(runUntappdRatingsSync(payload))).resolves.toMatchObject({
      updated: 0,
      skipped: 2,
      errors: 0,
    })
    expect(Date.now() - started).toBeGreaterThanOrEqual(900)
  })

  it('counts failed requests as errors rather than silent skips', async () => {
    find.mockResolvedValue({
      docs: [RATE_LIMITED_BEER],
    })
    fetchUntappdData.mockResolvedValue(FAILED_UNTAPPD)

    await expect(runWithFakeTimers(runUntappdRatingsSync(payload))).resolves.toMatchObject({
      updated: 0,
      skipped: 0,
      errors: 1,
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('throws from the task handler so Payload runs its configured retries', async () => {
    find.mockResolvedValue({
      docs: [RATE_LIMITED_BEER],
    })
    fetchUntappdData.mockResolvedValue(FAILED_UNTAPPD)

    const handler = syncUntappdRatingsTask.handler as (args: {
      req: { payload: Payload }
    }) => Promise<unknown>

    const result = handler({ req: { payload } })
    const assertion = expect(result).rejects.toThrow(/incomplete/i)
    await vi.runAllTimersAsync()
    await assertion
  })

  it('does not write when ratings, counts, and reviews are unchanged', async () => {
    find.mockResolvedValue({
      docs: [beerDoc({ id: 'b1', name: 'Unchanged', untappd: 'https://untappd.com/b/unchanged' })],
    })
    fetchUntappdData.mockResolvedValue({ rating: 4, ratingCount: 100, positiveReviews: [] })

    await expect(runWithFakeTimers(runUntappdRatingsSync(payload))).resolves.toMatchObject({
      updated: 0,
      skipped: 1,
    })
    expect(update).not.toHaveBeenCalled()
  })
})

describe('sync-untappd cron runner', () => {
  it('schedules and runs one maintenance job with one cache invalidation batch', async () => {
    handleSchedules.mockResolvedValue({ queued: [{}], skipped: [], errored: [] })
    runJobs.mockResolvedValue({
      jobStatus: { 'job-1': { status: 'success' } },
      remainingJobsFromQueried: 0,
    })

    const response = await GET(cronRequest())

    expect(response.status).toBe(200)
    expect(handleSchedules).toHaveBeenCalledWith({ queue: 'maintenance' })
    expect(runJobs).toHaveBeenCalledWith({ queue: 'maintenance', limit: 1, sequential: true })
    expect(revalidateTag.mock.calls.map((call) => call[0]).sort()).toEqual(['beers', 'menus'])
    expect(revalidatePath.mock.calls.map((call) => call[0]).sort()).toEqual(['/', '/beer'])
  })

  it('rejects a missing cron secret configuration', async () => {
    delete process.env.CRON_SECRET
    const response = await GET(
      new NextRequest('http://localhost/api/cron/sync-untappd', {
        headers: { authorization: 'Bearer undefined' },
      }),
    )

    expect(response.status).toBe(401)
    expect(handleSchedules).not.toHaveBeenCalled()
  })
})
