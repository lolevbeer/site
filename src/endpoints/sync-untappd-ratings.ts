/**
 * Bulk sync Untappd ratings for all beers
 *
 * Logic:
 * - Skip beers without untappd field
 * - If untappd matches /b/ format, just refresh the rating
 * - If untappd has a value but wrong format, search and update URL + rating
 */

import type { PayloadHandler } from 'payload'
import { getUserFromRequest } from './auth-helper'

// Expected format: /b/lolev-beer-something/123456
const VALID_UNTAPPD_URL_PATTERN = /^\/b\/[a-z0-9-]+\/\d+$/i

interface SearchResult {
  name: string
  url: string
  brewery?: string
}

/**
 * Search Untappd for beers matching "lolev + query"
 */
async function searchUntappd(query: string): Promise<SearchResult[]> {
  const searchUrl = `https://untappd.com/search?q=lolev+${encodeURIComponent(query)}`

  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  })

  if (!response.ok) {
    return []
  }

  const html = await response.text()
  const results: SearchResult[] = []

  // Match beer results: <p class="name"><a href="/b/...">Name</a></p>
  const beerRegex = /<p class="name">\s*<a href="(\/b\/[^"]+)">([^<]+)<\/a>\s*<\/p>/gi
  let match

  while ((match = beerRegex.exec(html)) !== null) {
    const url = match[1]
    const name = match[2].trim()

    // Only include Lolev beers
    if (url.toLowerCase().includes('lolev')) {
      results.push({ name, url })
    }
  }

  return results
}

interface UntappdReview {
  username: string
  rating: number
  text: string
  date?: string
  url?: string
  image?: string
}

interface UntappdData {
  rating: number | null
  ratingCount: number | null
  positiveReviews: UntappdReview[]
}

/**
 * Fetch rating, rating count, and positive reviews from an Untappd beer page
 */
async function fetchUntappdData(url: string): Promise<UntappdData> {
  const fullUrl = url.startsWith('http') ? url : `https://untappd.com${url}`

  const response = await fetch(fullUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  })

  if (!response.ok) {
    return { rating: null, ratingCount: null, positiveReviews: [] }
  }

  const html = await response.text()

  // Extract rating
  let rating: number | null = null
  const ratingMatch = html.match(/<div[^>]*class="caps"[^>]*data-rating="([^"]+)"/)
  if (ratingMatch?.[1]) {
    const parsed = parseFloat(ratingMatch[1])
    if (!isNaN(parsed)) rating = parsed
  }
  // Alternative format
  if (rating === null) {
    const altMatch = html.match(/data-rating="([\d.]+)"/)
    if (altMatch?.[1]) {
      const parsed = parseFloat(altMatch[1])
      if (!isNaN(parsed)) rating = parsed
    }
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
  const checkinRegex = /<div[^>]*class="item\s*"[^>]*id="checkin_(\d+)"[^>]*>([\s\S]*?)(?=<div[^>]*class="item\s*"[^>]*id="checkin_|$)/gi
  let checkinMatch

  while ((checkinMatch = checkinRegex.exec(html)) !== null) {
    const checkinId = checkinMatch[1]
    const checkinHtml = checkinMatch[2]

    // Check if Lolev has toasted this checkin (brewery ID 519872)
    const hasLolevToast = /class="user-toasts[^"]*"[^>]*href="\/brewery\/519872"/.test(checkinHtml)
    if (!hasLolevToast) continue

    // Extract rating from caps div
    const checkinRatingMatch = checkinHtml.match(/<div[^>]*class="caps[^"]*"[^>]*data-rating="([\d.]+)"/)
    const checkinRating = checkinRatingMatch ? parseFloat(checkinRatingMatch[1]) : 0

    // Extract comment text
    const commentMatch = checkinHtml.match(/<p[^>]*class="comment-text"[^>]*>([\s\S]*?)<\/p>/i)
    const text = commentMatch ? commentMatch[1].trim() : ''

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
    const imageMatch = checkinHtml.match(/<p[^>]*class="photo"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/)
    const image = imageMatch ? imageMatch[1] : undefined

    positiveReviews.push({ username, rating: checkinRating, text, date, url: checkinUrl, image })
  }

  return { rating, ratingCount, positiveReviews }
}

export const syncUntappdRatings: PayloadHandler = async (req) => {
  // Check authentication with fallback for Vercel
  const user = req.user ?? await getUserFromRequest(req, req.payload)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url || '', 'http://localhost')
  const dryRun = url.searchParams.get('dryRun') === 'true'

  // Create a streaming response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Get all beers
        const beers = await req.payload.find({
          collection: 'beers',
          limit: 500,
          depth: 0,
        })

        const total = beers.docs.length

        send('status', { message: `Processing ${total} beers` })

        let updated = 0
        let skipped = 0
        let errors = 0
        let refreshed = 0

        for (let i = 0; i < beers.docs.length; i++) {
          const beer = beers.docs[i]
          const untappdValue = beer.untappd?.trim() || ''
          const hasUntappd = untappdValue !== ''
          const isValidFormat = VALID_UNTAPPD_URL_PATTERN.test(untappdValue)

          send('progress', {
            current: i + 1,
            total,
            name: beer.name,
            percent: Math.round(((i + 1) / total) * 100),
          })

          // Add delay to avoid rate limiting
          if (i > 0) {
            await new Promise((resolve) => setTimeout(resolve, 500))
          }

          try {
            if (isValidFormat) {
              // Just refresh the rating
              const { rating, ratingCount, positiveReviews } = await fetchUntappdData(untappdValue)

              if (rating !== null) {
                // Merge with existing reviews
                const existingReviews = (beer.positiveReviews as UntappdReview[]) || []
                const existingUrls = new Set(existingReviews.map((r) => r.url).filter(Boolean))
                const newReviews = positiveReviews.filter((r) => r.url && !existingUrls.has(r.url))
                const mergedReviews = [...existingReviews, ...newReviews]

                if (!dryRun) {
                  await req.payload.update({
                    collection: 'beers',
                    id: beer.id,
                    data: {
                      untappdRating: rating,
                      untappdRatingCount: ratingCount ?? undefined,
                      positiveReviews: mergedReviews.length > 0 ? mergedReviews : undefined,
                    },
                  })
                }
                refreshed++
                send('item', {
                  name: beer.name,
                  status: 'refreshed',
                  message: `Refreshed rating: ${rating}${ratingCount ? ` (${ratingCount.toLocaleString()} ratings)` : ''}${newReviews.length > 0 ? `, +${newReviews.length} reviews` : ''}`,
                  rating,
                  ratingCount,
                  newReviews: newReviews.length,
                })
              } else {
                skipped++
                send('item', {
                  name: beer.name,
                  status: 'skipped',
                  message: 'Could not fetch rating from page',
                })
              }
            } else if (hasUntappd) {
              // Has value but invalid format - search for the beer
              send('item', {
                name: beer.name,
                status: 'searching',
                message: `Invalid format "${untappdValue}", searching...`,
              })

              const results = await searchUntappd(beer.name)

              if (results.length === 0) {
                skipped++
                send('item', {
                  name: beer.name,
                  status: 'not-found',
                  message: 'No results found on Untappd',
                })
              } else if (results.length === 1) {
                // Single result - auto-select
                const result = results[0]
                const { rating, ratingCount, positiveReviews } = await fetchUntappdData(result.url)

                // Merge with existing reviews
                const existingReviews = (beer.positiveReviews as UntappdReview[]) || []
                const existingUrls = new Set(existingReviews.map((r) => r.url).filter(Boolean))
                const newReviews = positiveReviews.filter((r) => r.url && !existingUrls.has(r.url))
                const mergedReviews = [...existingReviews, ...newReviews]

                if (!dryRun) {
                  await req.payload.update({
                    collection: 'beers',
                    id: beer.id,
                    data: {
                      untappd: result.url,
                      untappdRating: rating ?? undefined,
                      untappdRatingCount: ratingCount ?? undefined,
                      positiveReviews: mergedReviews.length > 0 ? mergedReviews : undefined,
                    },
                  })
                }
                updated++
                send('item', {
                  name: beer.name,
                  status: 'updated',
                  message: `Updated URL to ${result.url}${rating !== null ? `, rating: ${rating}` : ''}${ratingCount ? ` (${ratingCount.toLocaleString()} ratings)` : ''}${newReviews.length > 0 ? `, +${newReviews.length} reviews` : ''}`,
                  url: result.url,
                  rating,
                  ratingCount,
                  newReviews: newReviews.length,
                })
              } else {
                // Multiple results - skip (needs manual selection)
                skipped++
                send('item', {
                  name: beer.name,
                  status: 'multiple',
                  message: `Found ${results.length} results - needs manual selection`,
                  results: results.map((r) => r.name),
                })
              }
            } else {
              // No untappd value - search for the beer by name
              const results = await searchUntappd(beer.name)

              if (results.length === 0) {
                skipped++
                send('item', {
                  name: beer.name,
                  status: 'not-found',
                  message: 'No results found on Untappd',
                })
              } else if (results.length === 1) {
                // Single result - auto-select
                const result = results[0]
                const { rating, ratingCount, positiveReviews } = await fetchUntappdData(result.url)

                // Merge with existing reviews (likely empty for new beers)
                const existingReviews = (beer.positiveReviews as UntappdReview[]) || []
                const existingUrls = new Set(existingReviews.map((r) => r.url).filter(Boolean))
                const newReviews = positiveReviews.filter((r) => r.url && !existingUrls.has(r.url))
                const mergedReviews = [...existingReviews, ...newReviews]

                if (!dryRun) {
                  await req.payload.update({
                    collection: 'beers',
                    id: beer.id,
                    data: {
                      untappd: result.url,
                      untappdRating: rating ?? undefined,
                      untappdRatingCount: ratingCount ?? undefined,
                      positiveReviews: mergedReviews.length > 0 ? mergedReviews : undefined,
                    },
                  })
                }
                updated++
                send('item', {
                  name: beer.name,
                  status: 'new',
                  message: `Found ${result.url}${rating !== null ? `, rating: ${rating}` : ''}${ratingCount ? ` (${ratingCount.toLocaleString()} ratings)` : ''}${newReviews.length > 0 ? `, +${newReviews.length} reviews` : ''}`,
                  url: result.url,
                  rating,
                  ratingCount,
                  newReviews: newReviews.length,
                })
              } else {
                // Multiple results - skip (needs manual selection)
                skipped++
                send('item', {
                  name: beer.name,
                  status: 'multiple',
                  message: `Found ${results.length} results - needs manual selection`,
                  results: results.map((r) => r.name),
                })
              }
            }
          } catch (err: any) {
            errors++
            send('item', {
              name: beer.name,
              status: 'error',
              message: err.message || 'Unknown error',
            })
          }
        }

        send('complete', {
          success: true,
          dryRun,
          results: {
            total,
            refreshed,
            updated,
            skipped,
            errors,
          },
        })
      } catch (error: any) {
        send('error', { message: error.message || 'Sync failed' })
        send('complete', { success: false, error: error.message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
