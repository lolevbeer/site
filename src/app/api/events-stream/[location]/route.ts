import { NextRequest, NextResponse } from 'next/server'

import type { BreweryEvent } from '@/lib/types/event'
import { logger } from '@/lib/utils/logger'
import {
  getAllLocations,
  getUpcomingEventsFromPayload,
  transformPayloadEventToBreweryEvent,
} from '@/lib/utils/payload-api'
import { getPittsburghTheme } from '@/lib/utils/pittsburgh-time'

/**
 * Events fetch for the polling endpoint. Both underlying helpers are already
 * tag-cached in payload-api, so the route adds no cache layer of its own.
 */
async function getCachedEvents(locationSlug: string) {
  const locations = await getAllLocations()
  const location = locations.find((doc) => doc.slug === locationSlug)

  if (!location) {
    return null
  }

  const eventDocs = await getUpcomingEventsFromPayload(locationSlug, 20)

  const events: BreweryEvent[] = eventDocs.map((event) =>
    transformPayloadEventToBreweryEvent(event, locationSlug, location.name),
  )

  const latestUpdate = eventDocs.reduce((latest, doc) => {
    const docTime = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0
    return docTime > latest ? docTime : latest
  }, 0)

  return {
    events,
    locationName: location.name,
    timestamp: latestUpdate || Date.now(),
  }
}

/**
 * Events polling endpoint for large displays.
 * Returns events data as JSON with edge-cache headers.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ location: string }> },
): Promise<NextResponse> {
  const { location } = await params

  try {
    const data = await getCachedEvents(location.toLowerCase())

    if (!data) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    return NextResponse.json(
      {
        events: data.events,
        locationName: data.locationName,
        theme: getPittsburghTheme(),
        timestamp: data.timestamp,
        deployId: process.env.NEXT_PUBLIC_DEPLOY_ID || '',
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        },
      },
    )
  } catch (error) {
    logger.error('Events fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}
