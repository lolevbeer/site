import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { LiveEvents } from '@/components/events/live-events'
import { notFound } from 'next/navigation'
import { BreweryEvent, EventType, EventStatus } from '@/lib/types/event'
import type { LocationSlug } from '@/lib/types/location'

// Force dynamic rendering to avoid DB connection during build
export const dynamic = 'force-dynamic'

interface EventsDisplayPageProps {
  params: Promise<{
    location: string
  }>
}

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
}

/**
 * Fetch events for a specific location
 */
async function getEventsByLocation(locationSlug: string): Promise<{
  events: BreweryEvent[]
  locationName: string
} | null> {
  const payload = await getPayload({ config })

  // Get location by slug
  const locationResult = await payload.find({
    collection: 'locations',
    where: {
      slug: { equals: locationSlug.toLowerCase() },
    },
    limit: 1,
  })

  if (locationResult.docs.length === 0) {
    return null
  }

  const location = locationResult.docs[0]

  const today = new Date()
  today.setHours(0, 0, 0, 0)

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

  return {
    events,
    locationName: location.name,
  }
}

export default async function EventsDisplayPage({ params }: EventsDisplayPageProps) {
  const { location } = await params
  const data = await getEventsByLocation(location)

  if (!data) {
    notFound()
  }

  return (
    <LiveEvents
      location={location.toLowerCase()}
      initialEvents={data.events}
      initialLocationName={data.locationName}
    />
  )
}

export async function generateMetadata({ params }: EventsDisplayPageProps) {
  const { location } = await params
  const data = await getEventsByLocation(location)

  if (!data) {
    return {
      title: 'Events Not Found',
    }
  }

  return {
    title: `Events - ${data.locationName}`,
    description: `Upcoming events at ${data.locationName}`,
  }
}
