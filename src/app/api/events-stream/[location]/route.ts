import { NextRequest, NextResponse } from 'next/server'

import { logger } from '@/lib/utils/logger'
import {
  getAllLocations,
  getUpcomingEventsFromPayload,
  transformPayloadEventToBreweryEvent,
} from '@/lib/utils/payload-api'
import { getPittsburghTheme } from '@/lib/utils/pittsburgh-time'
import {
  STREAM_CACHE_CONTROL,
  contentTimestampFromEvents,
  isWarm,
} from '@/lib/utils/stream-freshness'

/**
 * Events fetch for the polling endpoint. Both underlying helpers are already
 * tag-cached in payload-api, so the route adds no cache layer of its own.
 */
async function getEventsForLocation(locationSlug: string) {
  const locations = await getAllLocations()
  const location = locations.find((doc) => doc.slug === locationSlug)

  if (!location) {
    return null
  }

  const eventDocs = await getUpcomingEventsFromPayload(locationSlug, 20)

  return {
    events: eventDocs.map((event) =>
      transformPayloadEventToBreweryEvent(event, locationSlug, location.name),
    ),
    locationName: location.name,
    timestamp: contentTimestampFromEvents(eventDocs),
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
    const data = await getEventsForLocation(location.toLowerCase())

    if (!data) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const warm = isWarm(data.timestamp)

    return NextResponse.json(
      {
        events: data.events,
        locationName: data.locationName,
        theme: getPittsburghTheme(),
        timestamp: data.timestamp,
        deployId: process.env.NEXT_PUBLIC_DEPLOY_ID || '',
        warm,
      },
      {
        headers: {
          'Cache-Control': STREAM_CACHE_CONTROL,
        },
      },
    )
  } catch (error) {
    logger.error('Events fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}
