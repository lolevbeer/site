/**
 * Backfills `beer-reviews` docs for beers that still carry legacy
 * `positiveReviews` JSON but have none. 20260826_210000 normalized every beer,
 * but a later save whose afterChange sync failed (Beers.ts logs and swallows
 * sync errors) left some beers with legacy reviews only, and re-saving never
 * retries because the sync only runs when `positiveReviews` changes. The beer
 * page's legacy fallback is being removed, so these beers must have docs first.
 *
 * Safe to re-run: beers that already have any review doc are skipped, and
 * syncBeerReviews itself upserts by source URL.
 */
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

      const { totalDocs } = await payload.count({
        collection: 'beer-reviews',
        where: { beer: { equals: beer.id } },
        overrideAccess: true,
        req,
      })
      if (totalDocs > 0) continue

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

  payload.logger.info(`Backfilled beer-reviews for ${backfilled} beer(s) with legacy reviews only`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // No-op: deleting the backfilled review docs would also discard any
  // moderation (approve/hide) managers applied since, and the legacy JSON this
  // migration read from is left untouched, so there is nothing to restore.
}
