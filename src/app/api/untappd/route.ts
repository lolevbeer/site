/**
 * Untappd API routes for searching beers and fetching ratings
 * Search goes through Untappd's public Algolia index (their search page is
 * client-rendered); ratings are scraped from beer pages since their API
 * requires approval.
 * Requires authentication - only accessible to logged in admin users
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { fetchUntappdData, type UntappdReview } from '@/src/utils/untappd'
import { logger } from '@/lib/utils/logger'

interface UntappdSearchResult {
  name: string
  url: string
  brewery?: string
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

interface AlgoliaBeerHit {
  bid: number
  beer_name: string
  beer_slug: string
  brewery_name?: string
}

/**
 * Untappd's public Algolia search credentials (visible to any browser on
 * untappd.com/search). Seeded with the current values because scraping them
 * from the search page 403s from datacenter IPs (Cloudflare bot protection);
 * refreshAlgoliaCreds re-scrapes only if Algolia ever rejects these.
 */
let algoliaCreds = { appId: '9WBO4RQ3HO', searchKey: '1d347324d67ec472bb7132c66aead485' }

/**
 * Re-scrape Algolia credentials from Untappd's search page config blob.
 * Only called when the cached creds are rejected (rotation). May itself fail
 * with 403 when Cloudflare blocks the server's IP — callers surface that.
 */
async function refreshAlgoliaCreds(): Promise<{ error: string; status: number } | null> {
  const pageResponse = await fetch('https://untappd.com/search?q=lolev', {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    next: { revalidate: 0 },
  })

  if (!pageResponse.ok) {
    return { error: `Untappd returned ${pageResponse.status}`, status: pageResponse.status }
  }

  const html = await pageResponse.text()
  const configMatch = html.match(/"appId":"([^"]+)","searchKey":"([^"]+)"/)
  if (!configMatch) {
    logger.error('Untappd search config not found - page structure may have changed')
    return { error: 'Untappd search config not found', status: 502 }
  }
  algoliaCreds = { appId: configMatch[1], searchKey: configMatch[2] }
  return null
}

/** Query Untappd's Algolia beer index directly (not behind Untappd's Cloudflare). */
function queryAlgolia(fullQuery: string): Promise<Response> {
  const { appId, searchKey } = algoliaCreds
  return fetch(`https://${appId}-dsn.algolia.net/1/indexes/beer/query`, {
    method: 'POST',
    headers: {
      'X-Algolia-Application-Id': appId,
      'X-Algolia-API-Key': searchKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ params: `query=${encodeURIComponent(fullQuery)}&hitsPerPage=10` }),
    next: { revalidate: 0 },
  })
}

/**
 * Search Untappd for beers matching "lolev + query" via their public Algolia
 * index (their search page is client-rendered, so this is what the site itself
 * uses). Cached credentials are used first; if Algolia rejects them (rotated),
 * we re-scrape them from the search page and retry once.
 */
async function searchUntappd(query: string): Promise<NextResponse> {
  try {
    const fullQuery = `lolev ${query}`
    const searchUrl = `https://untappd.com/search?q=${encodeURIComponent(fullQuery)}`

    // A rotated app id changes the request hostname, so stale creds can
    // surface as a thrown fetch (DNS failure), not just a 401/403 — treat any
    // first-attempt failure as "creds may be stale" and try one refresh.
    // ponytail: refreshed creds live in per-lambda module state, so each cold
    // instance re-scrapes; persist them (env/KV) if rotation ever gets frequent.
    let algoliaResponse: Response | null = null
    try {
      algoliaResponse = await queryAlgolia(fullQuery)
    } catch {
      algoliaResponse = null
    }

    if (!algoliaResponse || !algoliaResponse.ok) {
      const refreshError = await refreshAlgoliaCreds()
      if (refreshError) {
        return NextResponse.json({ error: refreshError.error }, { status: refreshError.status })
      }
      algoliaResponse = await queryAlgolia(fullQuery)
    }

    if (!algoliaResponse.ok) {
      return NextResponse.json(
        { error: `Untappd search returned ${algoliaResponse.status}` },
        { status: algoliaResponse.status },
      )
    }

    const data = await algoliaResponse.json()
    const hits: AlgoliaBeerHit[] = data.hits ?? []

    // Only include Lolev beers (slug contains the brewery name)
    const results: UntappdSearchResult[] = hits
      .filter((hit) => hit.beer_slug?.toLowerCase().includes('lolev'))
      .map((hit) => ({
        name: hit.beer_name,
        url: `/b/${hit.beer_slug}/${hit.bid}`,
        brewery: hit.brewery_name,
      }))

    return NextResponse.json({ results, searchUrl })
  } catch (error) {
    logger.error('Error searching Untappd:', error)
    return NextResponse.json({ error: 'Failed to search Untappd' }, { status: 500 })
  }
}

/**
 * Fetch rating from an Untappd beer page using shared utility
 */
async function fetchRating(url: string): Promise<NextResponse> {
  try {
    const { rating, ratingCount, positiveReviews } = await fetchUntappdData(url)

    return NextResponse.json({ rating, ratingCount, positiveReviews, url } as UntappdRatingResult)
  } catch (error) {
    logger.error('Error fetching Untappd rating:', error)
    return NextResponse.json({ error: 'Failed to fetch rating' }, { status: 500 })
  }
}
