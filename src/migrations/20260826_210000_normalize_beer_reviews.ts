import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'
import { reviewToLegacy, syncBeerReviews, type LegacyUntappdReview } from '@/src/utils/beer-reviews'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const beers = await payload.find({
      collection: 'beers',
      where: { positiveReviews: { exists: true } },
      depth: 0,
      limit: 100,
      page,
      overrideAccess: true,
      req,
    })

    for (const beer of beers.docs) {
      if (!Array.isArray(beer.positiveReviews)) continue
      await syncBeerReviews({
        beerId: beer.id,
        payload,
        req,
        reviews: beer.positiveReviews as LegacyUntappdReview[],
      })
    }

    hasNextPage = beers.hasNextPage
    page++
  }
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  const reviews = await payload.find({
    collection: 'beer-reviews',
    depth: 0,
    limit: 10_000,
    overrideAccess: true,
    req,
  })
  const reviewsByBeer = new Map<string, LegacyUntappdReview[]>()

  for (const review of reviews.docs) {
    const beerId = typeof review.beer === 'object' ? review.beer.id : review.beer
    const legacy = reviewsByBeer.get(beerId) || []
    legacy.push(reviewToLegacy(review))
    reviewsByBeer.set(beerId, legacy)
  }

  for (const [beerId, legacyReviews] of reviewsByBeer) {
    await payload.update({
      collection: 'beers',
      id: beerId,
      data: { positiveReviews: legacyReviews },
      context: { skipRevalidate: true, skipReviewSync: true },
      overrideAccess: true,
      req,
    })
  }

  for (const review of reviews.docs) {
    await payload.delete({
      collection: 'beer-reviews',
      id: review.id,
      context: { skipRevalidate: true },
      overrideAccess: true,
      req,
    })
  }
}
