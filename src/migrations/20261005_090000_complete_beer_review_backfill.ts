/** Complete interrupted backfills by replaying idempotent URL upserts. Existing moderation is preserved. */
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'
import { syncBeerReviews, type LegacyUntappdReview } from '@/src/utils/beer-reviews'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  let page = 1
  let hasNextPage = true
  let backfilled = 0

  while (hasNextPage) {
    const beers = await payload.find({
      collection: 'beers',
      where: { positiveReviews: { exists: true } },
      depth: 0,
      limit: 100,
      page,
      // Every status: a draft-only beer with legacy reviews needs docs too.
      draft: true,
      overrideAccess: true,
      req,
    })

    for (const beer of beers.docs) {
      if (!Array.isArray(beer.positiveReviews) || beer.positiveReviews.length === 0) continue

      await syncBeerReviews({
        beerId: beer.id,
        payload,
        req,
        reviews: beer.positiveReviews as LegacyUntappdReview[],
      })
      backfilled++
    }

    hasNextPage = beers.hasNextPage
    page++
  }

  payload.logger.info(`Backfilled beer-reviews for ${backfilled} beer(s) with legacy reviews`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // No-op: deleting the backfilled review docs would also discard any
  // moderation (approve/hide) managers applied since, and the legacy JSON this
  // migration read from is left untouched, so there is nothing to restore.
}
