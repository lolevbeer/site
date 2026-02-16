import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { getPittsburghTheme } from '@/lib/utils/pittsburgh-time'
import { unstable_cache } from 'next/cache'
import { CACHE_TAGS } from '@/lib/utils/cache'
import { BreweryEvent } from '@/lib/types/event'
import { transformPayloadEventToBreweryEvent } from '@/lib/utils/payload-api'
import { getTodayMidnightISO } from '@/lib/utils/date'
import { logger } from '@/lib/utils/logger'

/**
 * Cached events fetch with tag-based invalidation
 */
const getCachedEvents = (locationSlug: string) =>
  unstable_cache(
    async () => {
      const payload = await getPayload({ config })

      const todayStr = getTodayMidnightISO()

      // Get location ID from slug
      const locationResult = await payload.find({
        collection: 'locations',
        where: {
          slug: { equals: locationSlug },
        },
        limit: 1,
      })

      if (locationResult.docs.length === 0) {
        return null
      }

      const location = locationResult.docs[0]

      const result = await payload.find({
        collection: 'events',
        where: {
          visibility: { equals: 'public' },
          date: { greater_than_equal: todayStr },
          location: { equals: location.id },
        },
        sort: 'date',
        limit: 20,
        depth: 1,
      })

      const events: BreweryEvent[] = result.docs.map((event) =>
        transformPayloadEventToBreweryEvent(event, locationSlug, location.name)
      )

      // Get most recent updatedAt for timestamp
      const latestUpdate = result.docs.reduce((latest, doc) => {
        const docTime = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0
        return docTime > latest ? docTime : latest
      }, 0)

      return {
        events,
        locationName: location.name,
        timestamp: latestUpdate || Date.now(),
      }
    },
    [`events-stream-${locationSlug}`],
    {
      tags: [CACHE_TAGS.events, `events-${locationSlug}`],
      revalidate: 60,
    }
  )()

/**
 * Events polling endpoint for large displays
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ location: string }> }
) {
  const { location } = await params

  try {
    const data = await getCachedEvents(location.toLowerCase())

    if (!data) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      )
    }

    const theme = getPittsburghTheme()

    const deployId = process.env.NEXT_PUBLIC_DEPLOY_ID || ''

    return NextResponse.json(
      {
        events: data.events,
        locationName: data.locationName,
        theme,
        timestamp: data.timestamp,
        deployId,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        },
      }
    )
  } catch (error) {
    logger.error('Events fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}
