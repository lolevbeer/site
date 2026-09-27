import { NextRequest, NextResponse } from 'next/server'

import type { BreweryEvent } from '@/lib/types/event'
import { logger } from '@/lib/utils/logger'
import {
  getAllLocations,
  getUpcomingEventsFromPayload,
  transformPayloadEventToBreweryEvent,
} from '@/lib/utils/payload-api'

/**
 * Cached on Vercel's CDN like /api/menu-stream: each location is cached on its
 * first request, event and location edits invalidate it through the fetchers'
 * cache tags, and it refreshes at least every 10 minutes so events that have
 * ended drop off (displays also hide past days themselves) and a new
 * deployment's `deployId` reaches them.
 */
export const dynamic = 'force-static'
export const revalidate = 600

/** No locations are prerendered at build; each is cached on its first request. */
export function generateStaticParams() {
  return []
}

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
    // 0 with no events (not the clock), so an unchanged empty list stays unchanged.
    timestamp: latestUpdate,
  }
}

/**
 * Events polling endpoint for large displays. The response depends only on the
 * events, never the clock, so it stays cacheable: displays work out their
 * day/night theme themselves.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ location: string }> },
): Promise<NextResponse> {
  const { location } = await params

  let data: Awaited<ReturnType<typeof getCachedEvents>>
  try {
    data = await getCachedEvents(location.toLowerCase())
  } catch (error) {
    // Throw rather than answer 500: a failed refresh keeps serving the last
    // good cached events instead of caching an error for every display.
    logger.error('Events fetch error:', error)
    throw error
  }

  if (!data) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  return NextResponse.json({
    events: data.events,
    locationName: data.locationName,
    timestamp: data.timestamp,
    deployId: process.env.NEXT_PUBLIC_DEPLOY_ID || '',
  })
}
