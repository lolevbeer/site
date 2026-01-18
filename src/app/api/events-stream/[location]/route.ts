import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { getPittsburghTheme } from '@/lib/utils/pittsburgh-time'
import { unstable_cache } from 'next/cache'
import { CACHE_TAGS } from '@/lib/utils/cache'
import { BreweryEvent, EventType, EventStatus } from '@/lib/types/event'
import type { LocationSlug } from '@/lib/types/location'

interface PayloadEvent {
  id: string
  organizer: string
  description?: string
  date: string
  startTime?: string
  endTime?: string
  location?: { slug?: string; name?: string; id?: string } | string
  site?: string
  attendees?: number
  visibility?: string
  updatedAt?: string
}

/**
 * Cached events fetch with tag-based invalidation
 */
const getCachedEvents = (locationSlug: string) =>
  unstable_cache(
    async () => {
      const payload = await getPayload({ config })

      const today = new Date()
      today.setHours(0, 0, 0, 0)

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
          date: { greater_than_equal: today.toISOString() },
          location: { equals: location.id },
        },
        sort: 'date',
        limit: 20,
        depth: 1,
      })

      const events: BreweryEvent[] = (result.docs as PayloadEvent[]).map((event) => {
        const eventLocation = typeof event.location === 'object' ? event.location : null

        return {
          id: event.id,
          title: event.organizer,
          description: event.description || event.organizer,
          date: event.date.split('T')[0],
          time: event.startTime || '',
          endTime: event.endTime,
          vendor: event.organizer,
          type: EventType.SPECIAL_EVENT,
          status: EventStatus.SCHEDULED,
          location: (eventLocation?.slug || locationSlug) as LocationSlug,
          locationName: eventLocation?.name || location.name,
          site: event.site,
          attendees: event.attendees,
        }
      })

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

    return NextResponse.json(
      {
        events: data.events,
        locationName: data.locationName,
        theme,
        timestamp: data.timestamp,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=10',
        },
      }
    )
  } catch (error) {
    console.error('Events fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}
