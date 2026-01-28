import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { LiveEvents } from '@/components/events/live-events'
import { notFound } from 'next/navigation'
import { BreweryEvent, EventType, EventStatus } from '@/lib/types/event'
import type { LocationSlug } from '@/lib/types/location'
import { getMediaUrl } from '@/lib/utils/media-utils'
import { getCansMenu } from '@/lib/utils/payload-api'
import type { PayloadMenu } from '@/lib/utils/payload-api'

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

interface PayloadFoodEntry {
  id: string
  vendor: string | { id: string; name: string; site?: string | null; logo?: string | { url?: string } | null }
  date: string
  startTime?: string
  location?: { slug?: string; id?: string; name?: string } | string
}

export interface FoodItem {
  id: string
  vendor: string
  date: string
  time?: string
  site?: string
  logoUrl?: string
}

/**
 * Fetch events, food, and cans menu for a specific location
 */
async function getDataByLocation(locationSlug: string): Promise<{
  events: BreweryEvent[]
  food: FoodItem[]
  cansMenu: PayloadMenu | null
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

  // Fetch events, food, and cans menu in parallel
  const [eventsResult, foodResult, cansMenu] = await Promise.all([
    payload.find({
      collection: 'events',
      where: {
        visibility: { equals: 'public' },
        date: { greater_than_equal: today.toISOString() },
        location: { equals: location.id },
      },
      sort: 'date',
      limit: 20,
      depth: 1,
    }),
    payload.find({
      collection: 'food',
      where: {
        date: { greater_than_equal: today.toISOString() },
        location: { equals: location.id },
      },
      sort: 'date',
      limit: 20,
      depth: 2,
    }),
    getCansMenu(locationSlug.toLowerCase()),
  ])

  const events: BreweryEvent[] = (eventsResult.docs as PayloadEvent[]).map((event) => {
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

  const food: FoodItem[] = (foodResult.docs as unknown as PayloadFoodEntry[]).map((entry) => {
    const vendorName = typeof entry.vendor === 'object' ? entry.vendor.name : entry.vendor
    const vendorSite = typeof entry.vendor === 'object' ? entry.vendor.site : undefined
    const vendorLogo = typeof entry.vendor === 'object' ? getMediaUrl(entry.vendor.logo) : undefined

    return {
      id: entry.id,
      vendor: vendorName,
      date: entry.date.split('T')[0],
      time: entry.startTime,
      site: vendorSite ?? undefined,
      logoUrl: vendorLogo ?? undefined,
    }
  })

  return {
    events,
    food,
    cansMenu,
    locationName: location.name,
  }
}

export default async function EventsDisplayPage({ params }: EventsDisplayPageProps) {
  const { location } = await params
  const data = await getDataByLocation(location)

  if (!data) {
    notFound()
  }

  return (
    <LiveEvents
      location={location.toLowerCase()}
      initialEvents={data.events}
      initialFood={data.food}
      cansMenu={data.cansMenu}
      initialLocationName={data.locationName}
    />
  )
}

export async function generateMetadata({ params }: EventsDisplayPageProps) {
  const { location } = await params
  const data = await getDataByLocation(location)

  if (!data) {
    return {
      title: 'Not Found',
    }
  }

  const hasEvents = data.events.length > 0
  const hasFood = data.food.length > 0
  const title = hasEvents && hasFood
    ? `Food & Events - ${data.locationName}`
    : hasFood
      ? `Food - ${data.locationName}`
      : `Events - ${data.locationName}`

  return {
    title,
    description: `Upcoming food and events at ${data.locationName}`,
  }
}
