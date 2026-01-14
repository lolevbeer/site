/**
 * Untappd API routes for searching beers and fetching ratings
 * Scrapes Untappd website since their API requires approval
 * Requires authentication - only accessible to logged in admin users
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/src/payload.config'

interface UntappdSearchResult {
  name: string
  url: string
  brewery?: string
}

interface UntappdReview {
  username: string
  rating: number
  text: string
  date?: string
  url?: string
  image?: string
}

interface UntappdRatingResult {
  rating: number | null
  ratingCount: number | null
  positiveReviews: UntappdReview[]
  url: string
}

/**
 * GET /api/untappd?action=search&q=beer+name
 * GET /api/untappd?action=rating&url=/b/lolev-beer-lupula/123456
 */
export async function GET(request: NextRequest) {
  // Check authentication
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action')

  if (action === 'search') {
    const query = searchParams.get('q')
    if (!query) {
      return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 })
    }
    return searchUntappd(query)
  }

  if (action === 'rating') {
    const url = searchParams.get('url')
    if (!url) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
    }
    return fetchRating(url)
  }

  return NextResponse.json({ error: 'Invalid action. Use "search" or "rating"' }, { status: 400 })
}

/**
 * Search Untappd for beers matching "lolev + query"
 */
async function searchUntappd(query: string): Promise<NextResponse> {
  try {
    const searchUrl = `https://untappd.com/search?q=lolev+${encodeURIComponent(query)}`

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      next: { revalidate: 0 }, // Don't cache search results
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Untappd returned ${response.status}` },
        { status: response.status }
      )
    }

    const html = await response.text()
    const results = parseSearchResults(html)

    return NextResponse.json({ results, searchUrl })
  } catch (error) {
    console.error('Error searching Untappd:', error)
    return NextResponse.json(
      { error: 'Failed to search Untappd' },
      { status: 500 }
    )
  }
}

/**
 * Parse search results from Untappd HTML
 * Looking for: <p class="name"><a href="/b/lolev-beer-ddh-lupula/6376909">DDH Lupula</a></p>
 */
function parseSearchResults(html: string): UntappdSearchResult[] {
  const results: UntappdSearchResult[] = []

  // Match beer results: <p class="name"><a href="/b/...">Name</a></p>
  const beerRegex = /<p class="name">\s*<a href="(\/b\/[^"]+)">([^<]+)<\/a>\s*<\/p>/gi
  let match

  while ((match = beerRegex.exec(html)) !== null) {
    const url = match[1]
    const name = match[2].trim()

    // Only include Lolev beers (filter by URL containing "lolev")
    if (url.toLowerCase().includes('lolev')) {
      results.push({ name, url })
    }
  }

  // Also try to get brewery info if available
  // <p class="brewery"><a href="/lolev">Lolev Beer</a></p>
  const breweryRegex = /<p class="brewery">\s*<a href="[^"]+">([^<]+)<\/a>\s*<\/p>/gi
  const breweries: string[] = []
  while ((match = breweryRegex.exec(html)) !== null) {
    breweries.push(match[1].trim())
  }

  // Associate breweries with results if counts match
  if (breweries.length === results.length) {
    results.forEach((result, i) => {
      result.brewery = breweries[i]
    })
  }

  return results
}

/**
 * Fetch rating from an Untappd beer page
 */
async function fetchRating(url: string): Promise<NextResponse> {
  try {
    // Ensure URL is absolute
    const fullUrl = url.startsWith('http') ? url : `https://untappd.com${url}`

    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Untappd returned ${response.status}` },
        { status: response.status }
      )
    }

    const html = await response.text()
    const { rating, ratingCount, positiveReviews } = parseUntappdData(html)

    // Log for debugging
    console.log(`Untappd fetch for ${url}: rating=${rating}, ratingCount=${ratingCount}, reviews=${positiveReviews.length}`)
    if (positiveReviews.length === 0) {
      // Check if there are any checkin divs at all
      const checkinCount = (html.match(/<div class="checkin">/g) || []).length
      console.log(`Found ${checkinCount} checkin divs in HTML`)
    }

    return NextResponse.json({ rating, ratingCount, positiveReviews, url } as UntappdRatingResult)
  } catch (error) {
    console.error('Error fetching Untappd rating:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rating' },
      { status: 500 }
    )
  }
}

/**
 * Parse rating, rating count, and positive reviews from Untappd beer page HTML
 * Looking for: <div class="caps" data-rating="4.25"> and "X,XXX Ratings"
 * Also extracts check-ins with ratings >= 4.5 that have comment text
 */
function parseUntappdData(html: string): { rating: number | null; ratingCount: number | null; positiveReviews: UntappdReview[] } {
  // Extract rating
  let rating: number | null = null

  // Match: <div class="caps" data-rating="4.25">
  const ratingMatch = html.match(/<div[^>]*class="caps"[^>]*data-rating="([^"]+)"/)
  if (ratingMatch && ratingMatch[1]) {
    const parsed = parseFloat(ratingMatch[1])
    if (!isNaN(parsed)) {
      rating = parsed
    }
  }

  // Alternative: try to find rating in different format
  if (rating === null) {
    const altMatch = html.match(/data-rating="([\d.]+)"/)
    if (altMatch && altMatch[1]) {
      const parsed = parseFloat(altMatch[1])
      if (!isNaN(parsed)) {
        rating = parsed
      }
    }
  }

  // Extract rating count (e.g., "3,381 Ratings")
  let ratingCount: number | null = null
  const countMatch = html.match(/([\d,]+)\s*Ratings/i)
  if (countMatch && countMatch[1]) {
    const parsed = parseInt(countMatch[1].replace(/,/g, ''), 10)
    if (!isNaN(parsed)) {
      ratingCount = parsed
    }
  }

  // Extract positive reviews (4.5+ with text)
  const positiveReviews: UntappdReview[] = []

  // Match each checkin item block: <div class="item " id="checkin_123456" ...>...</div>
  // Use the checkin ID to find the end boundary
  const checkinRegex = /<div[^>]*class="item\s*"[^>]*id="checkin_(\d+)"[^>]*>([\s\S]*?)(?=<div[^>]*class="item\s*"[^>]*id="checkin_|$)/gi
  let checkinMatch

  while ((checkinMatch = checkinRegex.exec(html)) !== null) {
    const checkinId = checkinMatch[1]
    const checkinHtml = checkinMatch[2]

    // Extract rating from caps div: <div class="caps " data-rating="4.5">
    const checkinRatingMatch = checkinHtml.match(/<div[^>]*class="caps[^"]*"[^>]*data-rating="([\d.]+)"/)
    if (!checkinRatingMatch) continue

    const checkinRating = parseFloat(checkinRatingMatch[1])
    if (isNaN(checkinRating) || checkinRating < 4.5) continue

    // Extract comment text: <p class="comment-text" id="translate_...">text</p>
    const commentMatch = checkinHtml.match(/<p[^>]*class="comment-text"[^>]*>([\s\S]*?)<\/p>/i)
    if (!commentMatch || !commentMatch[1].trim()) continue

    const text = commentMatch[1].trim()

    // Extract username: <a href="/user/..." class="user">Name</a>
    const usernameMatch = checkinHtml.match(/<a[^>]*class="user"[^>]*>([^<]+)<\/a>/i)
    const username = usernameMatch ? usernameMatch[1].trim() : 'Anonymous'

    // Build checkin URL from the ID and username
    const userMatch = checkinHtml.match(/href="(\/user\/[^"]+)"[^>]*class="user"/)
    const checkinUrl = userMatch
      ? `https://untappd.com${userMatch[1]}/checkin/${checkinId}`
      : `https://untappd.com/user/checkin/${checkinId}`

    // Extract date: <a class="time...">date</a>
    const dateMatch = checkinHtml.match(/<a[^>]*class="time[^"]*"[^>]*>([^<]+)<\/a>/i)
    const date = dateMatch ? dateMatch[1].trim() : undefined

    // Extract image: <p class="photo">...<img src="...">...</p>
    const imageMatch = checkinHtml.match(/<p[^>]*class="photo"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/)
    const image = imageMatch ? imageMatch[1] : undefined

    positiveReviews.push({
      username,
      rating: checkinRating,
      text,
      date,
      url: checkinUrl,
      image,
    })
  }

  return { rating, ratingCount, positiveReviews }
}
