import type { Payload, TaskConfig } from 'payload'
import { fetchUntappdData, isCircuitOpen, resetCircuit } from '@/src/utils/untappd'
import { logger } from '@/lib/utils/logger'

export interface UntappdSyncResult {
  total: number
  updated: number
  skipped: number
  errors: number
  circuitBroken: boolean
}

export async function runUntappdRatingsSync(payload: Payload): Promise<UntappdSyncResult> {
  resetCircuit()

  const beers = await payload.find({
    collection: 'beers',
    where: {
      untappd: { exists: true },
    },
    limit: 500,
    depth: 0,
  })

  const results: UntappdSyncResult = {
    total: beers.docs.length,
    updated: 0,
    skipped: 0,
    errors: 0,
    circuitBroken: false,
  }

  for (const beer of beers.docs) {
    if (!beer.untappd) {
      results.skipped++
      continue
    }

    if (isCircuitOpen()) {
      results.circuitBroken = true
      results.skipped += beers.docs.length - results.updated - results.skipped - results.errors
      logger.warn('Untappd sync stopped: circuit breaker open', {
        processed: results.updated + results.skipped + results.errors,
        remaining: beers.docs.length - results.updated - results.skipped - results.errors,
      })
      break
    }

    try {
      const { rating, ratingCount, positiveReviews } = await fetchUntappdData(beer.untappd)

      if (rating === null) {
        results.skipped++
        continue
      }

      const existingReviews =
        (beer.positiveReviews as Array<{ url?: string }> | null | undefined) || []
      const existingUrls = new Set(existingReviews.map((review) => review.url).filter(Boolean))
      const newReviews = positiveReviews.filter(
        (review) => review.url && !existingUrls.has(review.url),
      )
      const ratingChanged = rating !== beer.untappdRating
      const countChanged = ratingCount !== null && ratingCount !== beer.untappdRatingCount

      if (!ratingChanged && !countChanged && newReviews.length === 0) {
        results.skipped++
        continue
      }

      await payload.update({
        collection: 'beers',
        id: beer.id,
        data: {
          untappdRating: rating,
          ...(ratingCount !== null ? { untappdRatingCount: ratingCount } : {}),
          ...(newReviews.length > 0
            ? { positiveReviews: [...existingReviews, ...newReviews] }
            : {}),
        },
        context: { skipRevalidate: true },
      })

      results.updated++
    } catch (error) {
      logger.error(`Error updating beer ${beer.name}:`, error)
      results.errors++
    }

    // Untappd is scraped without an official API; keep requests deliberately slow.
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return results
}

export const syncUntappdRatingsTask: TaskConfig = {
  slug: 'syncUntappdRatings',
  label: 'Sync Untappd Ratings',
  inputSchema: [],
  outputSchema: [
    { name: 'total', type: 'number', required: true },
    { name: 'updated', type: 'number', required: true },
    { name: 'skipped', type: 'number', required: true },
    { name: 'errors', type: 'number', required: true },
    { name: 'circuitBroken', type: 'checkbox', required: true },
  ],
  retries: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 60_000 },
  },
  schedule: [{ cron: '0 0 6 * * *', queue: 'maintenance' }],
  handler: async ({ req }) => ({ output: await runUntappdRatingsSync(req.payload) }),
}
