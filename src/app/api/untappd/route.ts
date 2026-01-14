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

interface UntappdRatingResult {
  rating: number | null
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
    const rating = parseRating(html)

    return NextResponse.json({ rating, url } as UntappdRatingResult)
  } catch (error) {
    console.error('Error fetching Untappd rating:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rating' },
      { status: 500 }
    )
  }
}

/**
 * Parse rating from Untappd beer page HTML
 * Looking for: <div class="caps" data-rating="4.25">
 */
function parseRating(html: string): number | null {
  // Match: <div class="caps" data-rating="4.25">
  const ratingMatch = html.match(/<div[^>]*class="caps"[^>]*data-rating="([^"]+)"/)

  if (ratingMatch && ratingMatch[1]) {
    const rating = parseFloat(ratingMatch[1])
    if (!isNaN(rating)) {
      return rating
    }
  }

  // Alternative: try to find rating in different format
  const altMatch = html.match(/data-rating="([\d.]+)"/)
  if (altMatch && altMatch[1]) {
    const rating = parseFloat(altMatch[1])
    if (!isNaN(rating)) {
      return rating
    }
  }

  return null
}
