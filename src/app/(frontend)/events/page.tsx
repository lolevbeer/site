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
import { eventsDescription } from '@/lib/utils/seo'
import { buildPageMetadata } from '@/lib/seo/resolve-metadata'
import { getHubIntro } from '@/lib/utils/site-seo'

// ISR: Revalidate every 5 minutes
export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const locations = await getAllLocations()
  const description = eventsDescription(locations)
  return buildPageMetadata({
    fallbackTitle: 'Events',
    fallbackDescription: description,
    canonicalPath: '/events',
    fallbackKeywords: ['brewery events', 'trivia night', 'live music', 'Pittsburgh brewery', 'beer events'],
    hubKey: 'events',
  })
}

/**
 * Fetch events server-side
 */
async function getEvents(): Promise<BreweryEvent[]> {
  const events = await getAllUpcomingEventsFromPayload(100)
  return events.map((event) => transformPayloadEventToBreweryEvent(event))
}

export default async function EventsPage() {
  const [events, locations, intro] = await Promise.all([getEvents(), getAllLocations(), getHubIntro('events')])
  const locationLookup = createLocationLookup(locations)

  const jsonLd = events.length > 0 ? generateEventListJsonLd(events, locationLookup) : null

  return (
    <>
      {/* JSON-LD structured data for all locations */}
      {jsonLd && <JsonLd data={jsonLd} />}

      <PageTransition>
        <EventsPageClient initialEvents={events} intro={intro} />
      </PageTransition>
    </>
  )
}
