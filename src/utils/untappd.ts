/**
 * Shared Untappd utilities for fetching beer data and reviews.
 * Uses HTML scraping (no official API) - fragile by nature.
 * Includes rate-limit detection and error reporting via Sentry.
 */

import * as Sentry from '@sentry/nextjs'

export const UNTAPPD_FETCH_TIMEOUT_MS = 10_000
export const UNTAPPD_MAX_BODY_BYTES = 5 * 1024 * 1024

const UNTAPPD_BEER_PATH = /^\/b\/[a-z0-9][a-z0-9-]*\/\d+\/?$/
const UNTAPPD_HOSTS = new Set(['untappd.com', 'www.untappd.com'])

/** Returns a canonical Untappd beer URL, or null without performing I/O. */
export function normalizeUntappdBeerUrl(input: string): URL | null {
  const isRelativeBeerPath = input.startsWith('/b/')
  // URL normalizes away a default port (:443), so reject explicit ports before parsing.
  if (!isRelativeBeerPath && /^https?:\/\/[^/?#]*:\d*(?:[/?#]|$)/i.test(input)) return null

  try {
    const parsed = isRelativeBeerPath ? new URL(input, 'https://untappd.com') : new URL(input)
    if (parsed.protocol !== 'https:') return null
    if (!UNTAPPD_HOSTS.has(parsed.hostname)) return null
    if (parsed.username || parsed.password || parsed.port) return null
    if (!UNTAPPD_BEER_PATH.test(parsed.pathname)) return null
    return new URL(parsed.pathname.replace(/\/$/, ''), 'https://untappd.com')
  } catch {
    return null
  }
}

async function discardResponseBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined)
}

async function readBoundedText(response: Response): Promise<string | null> {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > UNTAPPD_MAX_BODY_BYTES) {
    await discardResponseBody(response)
    return null
  }
  if (!response.body) return response.text()

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > UNTAPPD_MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined)
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  return Buffer.concat(chunks).toString('utf8')
}

export interface UntappdReview {
  username: string
  rating: number
  text: string
  date?: string
  url?: string
  image?: string
}

export interface UntappdData {
  rating: number | null
  ratingCount: number | null
  positiveReviews: UntappdReview[]
  /**
   * Set when the request itself failed (rate limit, 5xx, network error, dead
   * URL, or a skipped request because the circuit is open) rather than the page
   * simply having no rating; absent on success. See `PERMANENT_STATUSES` for
   * what separates the two kinds and why the distinction matters.
   */
  failure?: 'retryable' | 'permanent'
}

/**
 * HTTP statuses treated as permanent for a single beer URL. Everything else —
 * 429, 403, 5xx, network errors, an open circuit — is assumed transient and
 * worth a retry.
 *
 * The split exists so batch callers never fail a whole run over a dead link.
 * There is no "already synced today" short circuit, so a retry re-scrapes the
 * entire catalogue (a request plus a pacing delay per beer) and still hits the
 * same 404 — turning one stale URL into a job that never succeeds again.
 */
const PERMANENT_STATUSES = new Set([404, 410])

/** Tracks consecutive failures for circuit breaker logic */
let consecutiveFailures = 0
const MAX_CONSECUTIVE_FAILURES = 5

/**
 * Check if the circuit breaker is open (too many consecutive failures)
 */
export function isCircuitOpen(): boolean {
  return consecutiveFailures >= MAX_CONSECUTIVE_FAILURES
}

/**
 * Reset the circuit breaker (call after a successful request)
 */
export function resetCircuit(): void {
  consecutiveFailures = 0
}

/**
 * Fetch Untappd rating, rating count, and Lolev-toasted reviews from beer page.
 * Includes rate-limit detection and circuit breaker pattern.
 */
export async function fetchUntappdData(url: string): Promise<UntappdData> {
  const failed = (failure: 'retryable' | 'permanent'): UntappdData => ({
    rating: null,
    ratingCount: null,
    positiveReviews: [],
    failure,
  })

  const canonicalUrl = normalizeUntappdBeerUrl(url)
  if (!canonicalUrl) return failed('permanent')
  const fullUrl = canonicalUrl.toString()

  // Circuit breaker: skip requests if too many consecutive failures. The beer
  // itself is fine — the run was cut short — so this is retryable.
  if (isCircuitOpen()) {
    return failed('retryable')
  }

  try {
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(UNTAPPD_FETCH_TIMEOUT_MS),
    })

    if (response.status >= 300 && response.status < 400) {
      await discardResponseBody(response)
      return failed('permanent')
    }

    // Rate limit detection
    if (response.status === 429) {
      await discardResponseBody(response)
      consecutiveFailures++
      Sentry.captureMessage('Untappd rate limit hit', {
        level: 'warning',
        extra: { url: fullUrl, consecutiveFailures },
      })
      return failed('retryable')
    }

    if (!response.ok) {
      await discardResponseBody(response)
      // A dead URL says nothing about Untappd's health, so it must not count
      // toward the circuit breaker — five stale links would otherwise trip it
      // and skip the rest of a perfectly healthy catalogue.
      if (PERMANENT_STATUSES.has(response.status)) {
        Sentry.captureMessage('Untappd beer URL is gone', {
          level: 'warning',
          extra: { url: fullUrl, status: response.status },
        })
        return failed('permanent')
      }

      consecutiveFailures++
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        Sentry.captureMessage('Untappd circuit breaker opened after consecutive failures', {
          level: 'error',
          extra: { url: fullUrl, status: response.status, consecutiveFailures },
        })
      }
      return failed('retryable')
    }

    const html = await readBoundedText(response)
    if (html === null) return failed('permanent')

    // Detect if Untappd changed their markup (no rating div found on a page that should have one)
    const hasRatingDiv = html.includes('class="caps"')
    if (!hasRatingDiv && html.length > 1000) {
      Sentry.captureMessage('Untappd HTML structure may have changed - rating div not found', {
        level: 'warning',
        extra: { url: fullUrl, htmlLength: html.length },
      })
    }

    // Extract rating
    let rating: number | null = null
    const ratingMatch = html.match(/<div[^>]*class="caps"[^>]*data-rating="([^"]+)"/)
    if (ratingMatch?.[1]) {
      const parsed = parseFloat(ratingMatch[1])
      if (!isNaN(parsed)) rating = parsed
    }

    // Extract rating count (e.g., "3,381 Ratings")
    let ratingCount: number | null = null
    const countMatch = html.match(/([\d,]+)\s*Ratings/i)
    if (countMatch?.[1]) {
      const parsed = parseInt(countMatch[1].replace(/,/g, ''), 10)
      if (!isNaN(parsed)) ratingCount = parsed
    }

    // Extract reviews that Lolev has toasted (liked)
    const positiveReviews: UntappdReview[] = []
    const checkinRegex =
      /<div[^>]*class="item\s*"[^>]*id="checkin_(\d+)"[^>]*>([\s\S]*?)(?=<div[^>]*class="item\s*"[^>]*id="checkin_|$)/gi
    let checkinMatch

    while ((checkinMatch = checkinRegex.exec(html)) !== null) {
      const checkinId = checkinMatch[1]
      const checkinHtml = checkinMatch[2]

      // Check if Lolev has toasted this checkin (brewery ID 519872)
      const hasLolevToast = /class="user-toasts[^"]*"[^>]*href="\/brewery\/519872"/.test(
        checkinHtml,
      )
      if (!hasLolevToast) continue

      // Extract rating from caps div
      const checkinRatingMatch = checkinHtml.match(
        /<div[^>]*class="caps[^"]*"[^>]*data-rating="([\d.]+)"/,
      )
      const checkinRating = checkinRatingMatch ? parseFloat(checkinRatingMatch[1]) : 0

      // Extract comment text - skip reviews without comments
      const commentMatch = checkinHtml.match(/<p[^>]*class="comment-text"[^>]*>([\s\S]*?)<\/p>/i)
      const text = commentMatch ? commentMatch[1].trim() : ''
      if (!text) continue

      // Extract username
      const usernameMatch = checkinHtml.match(/<a[^>]*class="user"[^>]*>([^<]+)<\/a>/i)
      const username = usernameMatch ? usernameMatch[1].trim() : 'Anonymous'

      // Build checkin URL
      const userMatch = checkinHtml.match(/href="(\/user\/[^"]+)"[^>]*class="user"/)
      const checkinUrl = userMatch
        ? `https://untappd.com${userMatch[1]}/checkin/${checkinId}`
        : `https://untappd.com/user/checkin/${checkinId}`

      // Extract date
      const dateMatch = checkinHtml.match(/<a[^>]*class="time[^"]*"[^>]*>([^<]+)<\/a>/i)
      const date = dateMatch ? dateMatch[1].trim() : undefined

      // Extract image
      const imageMatch = checkinHtml.match(
        /<p[^>]*class="photo"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/,
      )
      const image = imageMatch ? imageMatch[1] : undefined

      positiveReviews.push({ username, rating: checkinRating, text, date, url: checkinUrl, image })
    }

    // Success - reset circuit breaker
    resetCircuit()

    return { rating, ratingCount, positiveReviews }
  } catch (error) {
    consecutiveFailures++

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      Sentry.captureException(error, {
        extra: {
          url: fullUrl,
          consecutiveFailures,
          context: 'Untappd scraper circuit breaker opened',
        },
      })
    }

    // Network/parse errors are transient by assumption.
    return failed('retryable')
  }
}
