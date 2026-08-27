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
   * to fix, but never failed over — retrying a dead link only re-scrapes the
   * whole catalogue to reach the same result.
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

  const settled = () => results.updated + results.skipped + results.errors + results.unavailable

  for (const beer of beers.docs) {
    if (!beer.untappd) {
      results.skipped++
      continue
    }

    if (isCircuitOpen()) {
      results.circuitBroken = true
      // Compute before mutating results.skipped so the log reports real progress.
      const remaining = beers.docs.length - settled()
      logger.warn('Untappd sync stopped: circuit breaker open', {
        processed: beers.docs.length - remaining,
        remaining,
      })
      results.skipped += remaining
      break
    }

    try {
      const { rating, ratingCount, positiveReviews, failed, retryable } = await fetchUntappdData(
        beer.untappd,
      )

      if (failed) {
        if (retryable === false) {
          logger.warn(`Untappd URL is unreachable for beer ${beer.name}`, { url: beer.untappd })
          results.unavailable++
        } else {
          results.errors++
        }
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
      await new Promise((resolve) => setTimeout(resolve, 500))
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
   * rather than thrown: a retry re-scrapes every beer from scratch (there is no
   * "already synced today" short circuit, and each beer costs a request plus a
   * 500 ms pace), so failing over one stale link would triple the nightly load
   * on Untappd and still never succeed until someone edits the URL.
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
