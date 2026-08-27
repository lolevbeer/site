import type { Payload, TaskConfig } from 'payload'
import { fetchUntappdData, isCircuitOpen, resetCircuit } from '@/src/utils/untappd'
import { logger } from '@/lib/utils/logger'

export interface UntappdSyncResult {
  total: number
  updated: number
  skipped: number
  /** Retryable failures: rate limit, 5xx, network error. These fail the task. */
  errors: number
  /**
   * Permanently unreachable beer URLs (404/410). Reported and left for a human
   * to fix, never failed over — see `PERMANENT_STATUSES` in `utils/untappd`.
   */
  unavailable: number
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
    unavailable: 0,
    circuitBroken: false,
  }

  for (const [index, beer] of beers.docs.entries()) {
    if (!beer.untappd) {
      results.skipped++
      continue
    }

    if (isCircuitOpen()) {
      results.circuitBroken = true
      const processed = results.updated + results.skipped + results.errors + results.unavailable
      const remaining = beers.docs.length - processed
      logger.warn('Untappd sync stopped: circuit breaker open', { processed, remaining })
      results.skipped += remaining
      break
    }

    try {
      const { rating, ratingCount, positiveReviews, failure } = await fetchUntappdData(
        beer.untappd,
      )

      if (failure === 'permanent') {
        logger.warn(`Untappd URL is unreachable for beer ${beer.name}`, { url: beer.untappd })
        results.unavailable++
        continue
      }

      if (failure) {
        results.errors++
        continue
      }

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
    } finally {
      // Untappd is scraped without an official API; keep requests deliberately
      // slow. In `finally` so the skip paths above (`continue`) are paced too —
      // a mostly-unchanged catalog would otherwise be scraped in a tight burst.
      // Nothing follows the last beer, so don't pace it.
      if (index < beers.docs.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
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
    { name: 'unavailable', type: 'number', required: true },
    { name: 'circuitBroken', type: 'checkbox', required: true },
  ],
  retries: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 60_000 },
  },
  schedule: [{ cron: '0 0 6 * * *', queue: 'maintenance' }],
  /**
   * Throws only for *retryable* trouble — a rate limit, 5xx, network error, or
   * the circuit breaker cutting the run short — so the `retries` above actually
   * run instead of the job being recorded as a success over stale data.
   *
   * Permanently dead beer URLs (404/410) land in `unavailable` and are logged
   * rather than thrown; see `PERMANENT_STATUSES` in `utils/untappd` for why.
   */
  handler: async ({ req }) => {
    const output = await runUntappdRatingsSync(req.payload)

    if (output.unavailable > 0) {
      logger.warn(`Untappd sync finished with ${output.unavailable} unreachable beer URL(s)`)
    }

    if (output.errors > 0 || output.circuitBroken) {
      throw new Error(
        `Untappd sync incomplete: ${output.errors} retryable error(s), ${output.skipped} skipped` +
          (output.circuitBroken ? ', circuit breaker opened' : ''),
      )
    }

    return { output }
  },
}
