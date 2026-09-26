import { describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { getPublicBeerReviews, pruneLegacyReview, syncBeerReviews } from '@/src/utils/beer-reviews'

function payloadWith(existingDocs: unknown[] = []) {
  const find = vi.fn(async () => ({ docs: existingDocs }))
  const create = vi.fn(async () => ({}))
  const update = vi.fn(async () => ({}))
  return {
    payload: { find, create, update } as unknown as Payload,
    find,
    create,
    update,
  }
}

// Stand-in for the hook's request: forwarding it keeps the helper's writes
// inside the save transaction that triggered them.
const req = { context: {} } as unknown as PayloadRequest

const sourceReview = {
  username: 'Reviewer',
  rating: 4.5,
  text: 'Excellent beer.',
  date: 'Aug 20, 2026',
  url: 'https://untappd.com/user/reviewer/checkin/123',
  image: 'https://example.com/review.jpg',
}

describe('beer review normalization', () => {
  it('creates a native approved review from legacy JSON', async () => {
    const { payload, create, find } = payloadWith()

    await expect(
      syncBeerReviews({ beerId: 'beer-1', payload, req, reviews: [sourceReview] }),
    ).resolves.toBe(1)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'beer-reviews', overrideAccess: true, req }),
    )
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'beer-reviews',
        data: expect.objectContaining({
          beer: 'beer-1',
          reviewer: 'Reviewer',
          approved: true,
          sourceUrl: sourceReview.url,
        }),
        context: { skipRevalidate: true },
        overrideAccess: true,
        req,
      }),
    )
  })

  it('preserves a manager approval decision when refreshing source fields', async () => {
    const { payload, update } = payloadWith([
      {
        id: 'review-1',
        beer: 'beer-1',
        reviewer: 'Reviewer',
        rating: 4.5,
        text: 'Old text',
        reviewedAt: new Date('Aug 20, 2026').toISOString(),
        sourceDate: 'Aug 20, 2026',
        sourceUrl: sourceReview.url,
        externalImageUrl: sourceReview.image,
        approved: false,
      },
    ])

    await expect(
      syncBeerReviews({ beerId: 'beer-1', payload, req, reviews: [sourceReview] }),
    ).resolves.toBe(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'review-1',
        overrideAccess: true,
        req,
        data: expect.not.objectContaining({ approved: expect.anything() }),
      }),
    )
  })
})

describe('public beer reviews', () => {
  const nativeReview = (id: string, approved: boolean) => ({
    id,
    beer: 'beer-1',
    reviewer: `Reviewer ${id}`,
    rating: 4,
    text: 'Good.',
    reviewedAt: '2026-08-20T00:00:00.000Z',
    sourceUrl: `https://untappd.com/checkin/${id}`,
    source: 'untappd' as const,
    approved,
    createdAt: '2026-08-20T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  })

  it('publishes only approved reviews', async () => {
    const { payload } = payloadWith([nativeReview('a', true), nativeReview('b', false)])

    const reviews = await getPublicBeerReviews(payload, 'beer-1')

    expect(reviews).toHaveLength(1)
    expect(reviews?.[0].url).toBe('https://untappd.com/checkin/a')
  })

  it('returns null when a beer has no normalized reviews so legacy JSON still renders', async () => {
    const { payload } = payloadWith()

    await expect(getPublicBeerReviews(payload, 'beer-1')).resolves.toBeNull()
  })

  it('publishes an empty list once every review is unapproved', async () => {
    const { payload } = payloadWith([nativeReview('a', false)])

    await expect(getPublicBeerReviews(payload, 'beer-1')).resolves.toEqual([])
  })
})

describe('legacy review pruning on delete', () => {
  function payloadWithBeer(positiveReviews: unknown) {
    const findByID = vi.fn(async () => ({ id: 'beer-1', positiveReviews }))
    const update = vi.fn(async () => ({}))
    return { payload: { findByID, update } as unknown as Payload, findByID, update }
  }

  it('drops the deleted review from the beer legacy JSON so it cannot be re-created', async () => {
    // Without this, the next Untappd sync that touches the beer would rebuild
    // the document from `positiveReviews` — approved, since legacy entries
    // carry no `hidden` flag — silently undoing the moderation.
    const other = { ...sourceReview, url: 'https://untappd.com/checkin/keep' }
    const { payload, update, findByID } = payloadWithBeer([sourceReview, other])

    await pruneLegacyReview({ beer: 'beer-1', payload, req, sourceUrl: sourceReview.url })

    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'beers', overrideAccess: true, req }),
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'beers',
        id: 'beer-1',
        data: { positiveReviews: [other] },
        context: { skipRevalidate: true, skipReviewSync: true },
        overrideAccess: true,
        req,
      }),
    )
  })

  it('leaves the beer untouched when the legacy JSON has no matching entry', async () => {
    const { payload, update } = payloadWithBeer([sourceReview])

    await pruneLegacyReview({
      payload,
      req,
      beer: 'beer-1',
      sourceUrl: 'https://untappd.com/checkin/absent',
    })

    expect(update).not.toHaveBeenCalled()
  })

  it('ignores a review with no beer or source URL', async () => {
    const { payload, findByID } = payloadWithBeer([sourceReview])

    await pruneLegacyReview({ beer: null, payload, req, sourceUrl: sourceReview.url })
    await pruneLegacyReview({ beer: 'beer-1', payload, req, sourceUrl: null })

    expect(findByID).not.toHaveBeenCalled()
  })
})
