import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { fetchUntappdData } from '@/src/utils/untappd'

/**
 * Cron job to sync Untappd ratings for all beers
 * Runs on a schedule configured in vercel.json
 */
export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await getPayload({ config })

    // Fetch all beers with Untappd URLs
    const beers = await payload.find({
      collection: 'beers',
      where: {
        untappd: { exists: true },
      },
      limit: 500,
      depth: 0,
    })

    const results = {
      total: beers.docs.length,
      updated: 0,
      skipped: 0,
      errors: 0,
    }

    // Process each beer
    for (const beer of beers.docs) {
      if (!beer.untappd) {
        results.skipped++
        continue
      }

      try {
        const { rating, ratingCount, positiveReviews } = await fetchUntappdData(beer.untappd)

        // Only update if we got valid data
        if (rating !== null) {
          const updateData: Record<string, unknown> = {
            untappdRating: rating,
          }

          if (ratingCount !== null) {
            updateData.untappdRatingCount = ratingCount
          }

          if (positiveReviews.length > 0) {
            // Merge with existing reviews, using URL as unique key
            const existingReviews = (beer.positiveReviews as { url?: string }[]) || []
            const existingUrls = new Set(existingReviews.map(r => r.url).filter(Boolean))
            const newReviews = positiveReviews.filter(r => r.url && !existingUrls.has(r.url))
            if (newReviews.length > 0) {
              updateData.positiveReviews = [...existingReviews, ...newReviews]
            }
          }

          await payload.update({
            collection: 'beers',
            id: beer.id,
            data: updateData,
          })

          results.updated++
        } else {
          results.skipped++
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`Error updating beer ${beer.name}:`, error)
        results.errors++
      }
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Untappd sync cron error:', error)
    return NextResponse.json(
      { error: 'Failed to sync Untappd ratings' },
      { status: 500 }
    )
  }
}

// Allow longer execution time for cron jobs
export const maxDuration = 300
