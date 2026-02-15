import { getPayload } from 'payload'
import config from '@/src/payload.config'
import { LiveEvents } from '@/components/events/live-events'
import { notFound } from 'next/navigation'
import { BreweryEvent } from '@/lib/types/event'
import { getCansMenu, getCombinedUpcomingFood, transformPayloadEventToBreweryEvent, extractVendorInfo } from '@/lib/utils/payload-api'
import type { PayloadMenu } from '@/lib/utils/payload-api'
import { getTodayMidnightISO } from '@/lib/utils/date'

// Force dynamic rendering to avoid DB connection during build
export const dynamic = 'force-dynamic'

interface EventsDisplayPageProps {
  params: Promise<{
    location: string
  }>
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

  const todayStr = getTodayMidnightISO()

  // Fetch events, food (individual + recurring), and cans menu in parallel
  const [eventsResult, combinedFood, cansMenu] = await Promise.all([
    payload.find({
      collection: 'events',
      where: {
        visibility: { equals: 'public' },
        date: { greater_than_equal: todayStr },
        location: { equals: location.id },
      },
      sort: 'date',
      limit: 20,
      depth: 1,
    }),
    getCombinedUpcomingFood(locationSlug.toLowerCase(), 20),
    getCansMenu(locationSlug.toLowerCase()),
  ])

  const events: BreweryEvent[] = eventsResult.docs.map((event) =>
    transformPayloadEventToBreweryEvent(event, locationSlug, location.name)
  )

  const food: FoodItem[] = combinedFood.map((entry) => {
    const { name, site, logoUrl } = extractVendorInfo(entry.vendor)
    const dateStr = typeof entry.date === 'string' ? entry.date.split('T')[0] : entry.date
    const time = ('startTime' in entry ? entry.startTime : ('time' in entry ? entry.time : undefined)) ?? undefined

    return {
      id: typeof entry.id === 'string' ? entry.id : String(entry.id),
      vendor: name || 'Unknown',
      date: dateStr,
      time: time,
      site,
      logoUrl,
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
