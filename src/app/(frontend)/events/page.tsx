/**
 * Events Page
 * Server component with JSON-LD for all locations
 */

import { Metadata } from 'next'
import { JsonLd } from '@/components/seo/json-ld'
import { EventsPageClient } from './events-page-client'
import { BreweryEvent } from '@/lib/types/event'
import {
  getAllLocations,
  getAllUpcomingEventsFromPayload,
  transformPayloadEventToBreweryEvent,
} from '@/lib/utils/payload-api'
import { createLocationLookup, generateEventListJsonLd } from '@/lib/utils/json-ld'
import { PageTransition } from '@/components/motion'

// ISR: Revalidate every 5 minutes
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Events',
  description:
    'Discover upcoming events at Lolev Beer. From trivia nights to live music, find your next great experience at our Lawrenceville and Zelienople locations.',
  keywords: ['brewery events', 'trivia night', 'live music', 'Pittsburgh brewery', 'beer events'],
  alternates: { canonical: '/events' },
  openGraph: {
    title: 'Events | Lolev Beer',
    description:
      'Discover upcoming events at Lolev Beer. From trivia nights to live music, find your next great experience.',
    type: 'website',
  },
}

/**
 * Fetch events server-side
 */
async function getEvents(): Promise<BreweryEvent[]> {
  const events = await getAllUpcomingEventsFromPayload(100)
  return events.map((event) => transformPayloadEventToBreweryEvent(event))
}

export default async function EventsPage() {
  const [events, locations] = await Promise.all([getEvents(), getAllLocations()])
  const locationLookup = createLocationLookup(locations)

  const jsonLd = events.length > 0 ? generateEventListJsonLd(events, locationLookup) : null

  return (
    <>
      {/* JSON-LD structured data for all locations */}
      {jsonLd && <JsonLd data={jsonLd} />}

      <PageTransition>
        <EventsPageClient initialEvents={events} />
      </PageTransition>
    </>
  )
}
