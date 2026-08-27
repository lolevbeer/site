import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { syncBeerReviews } from '@/src/utils/beer-reviews'

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
    const { payload, create } = payloadWith()

    await expect(
      syncBeerReviews({ beerId: 'beer-1', payload, reviews: [sourceReview] }),
    ).resolves.toBe(1)
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
      syncBeerReviews({ beerId: 'beer-1', payload, reviews: [sourceReview] }),
    ).resolves.toBe(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'review-1',
        data: expect.not.objectContaining({ approved: expect.anything() }),
      }),
    )
  })
})
