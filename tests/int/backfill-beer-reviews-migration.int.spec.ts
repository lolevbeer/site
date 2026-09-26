/**
 * Tests for the 20260926 backfill migration: only beers that still carry legacy
 * `positiveReviews` JSON but have zero `beer-reviews` docs are re-synced.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const syncBeerReviews = vi.hoisted(() => vi.fn(async () => 1))
vi.mock('@/src/utils/beer-reviews', () => ({ syncBeerReviews }))

import { up } from '@/src/migrations/20260926_190000_backfill_missing_beer_reviews'

const review = { username: 'R', rating: 4, text: 'Good', url: 'https://untappd.com/c/1' }

const beers = [
  { id: 'taupo', positiveReviews: [review] }, // legacy reviews, no docs → backfill
  { id: 'synced', positiveReviews: [review] }, // already has docs → skip
  { id: 'empty', positiveReviews: [] }, // nothing to backfill → skip
  { id: 'null', positiveReviews: null }, // nothing to backfill → skip
]

const req = { context: {} }

function migrationArgs(docCounts: Record<string, number>) {
  const find = vi.fn(async () => ({ docs: beers, hasNextPage: false }))
  const count = vi.fn(async ({ where }: { where: { beer: { equals: string } } }) => ({
    totalDocs: docCounts[where.beer.equals] ?? 0,
  }))
  return {
    args: { payload: { find, count, logger: { info: vi.fn() } }, req } as never,
    find,
    count,
  }
}

describe('backfill missing beer reviews migration', () => {
  beforeEach(() => syncBeerReviews.mockClear())

  it('syncs only beers with legacy reviews and zero review docs', async () => {
    const { args, find } = migrationArgs({ synced: 3 })

    await up(args)

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'beers', draft: true, overrideAccess: true, req }),
    )
    expect(syncBeerReviews).toHaveBeenCalledTimes(1)
    expect(syncBeerReviews).toHaveBeenCalledWith(
      expect.objectContaining({ beerId: 'taupo', req, reviews: [review] }),
    )
  })

  it('syncs nothing on a second run once docs exist', async () => {
    const { args } = migrationArgs({ taupo: 1, synced: 3 })

    await up(args)

    expect(syncBeerReviews).not.toHaveBeenCalled()
  })
})
