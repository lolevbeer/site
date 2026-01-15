/**
 * Shared Untappd utilities for fetching beer data and reviews
 */

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
}

/**
 * Fetch Untappd rating, rating count, and Lolev-toasted reviews from beer page
 */
export async function fetchUntappdData(url: string): Promise<UntappdData> {
  try {
    const fullUrl = url.startsWith('http') ? url : `https://untappd.com${url}`
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })
    if (!response.ok) return { rating: null, ratingCount: null, positiveReviews: [] }
    const html = await response.text()

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
      const imageMatch = checkinHtml.match(/<p[^>]*class="photo"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/)
      const image = imageMatch ? imageMatch[1] : undefined

      positiveReviews.push({ username, rating: checkinRating, text, date, url: checkinUrl, image })
    }

    return { rating, ratingCount, positiveReviews }
  } catch {
    return { rating: null, ratingCount: null, positiveReviews: [] }
  }
}
