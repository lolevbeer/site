/**
 * Events Page
 * Server component with JSON-LD for all locations
 */

import { Metadata } from 'next';
import { getPayload } from 'payload';
import config from '@/src/payload.config';
import { JsonLd } from '@/components/seo/json-ld';
import { EventsPageClient } from './events-page-client';
import { BreweryEvent } from '@/lib/types/event';
import { transformPayloadEventToBreweryEvent, getAllLocations } from '@/lib/utils/payload-api';
import { getTodayMidnightISO } from '@/lib/utils/date';
import { createLocationLookup, generateEventListJsonLd } from '@/lib/utils/json-ld';

// ISR: Revalidate every 5 minutes
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Events | Lolev Beer',
  description: 'Discover upcoming events at Lolev Beer. From trivia nights to live music, find your next great experience at our Lawrenceville and Zelienople locations.',
  keywords: ['brewery events', 'trivia night', 'live music', 'Pittsburgh brewery', 'beer events'],
  openGraph: {
    title: 'Events | Lolev Beer',
    description: 'Discover upcoming events at Lolev Beer. From trivia nights to live music, find your next great experience.',
    type: 'website',
  }
};

/**
 * Fetch events server-side
 */
async function getEvents(): Promise<BreweryEvent[]> {
  const payload = await getPayload({ config });

  const todayStr = getTodayMidnightISO();

  const result = await payload.find({
    collection: 'events',
    where: {
      visibility: { equals: 'public' },
      date: { greater_than_equal: todayStr },
    },
    sort: 'date',
    limit: 100,
    depth: 1,
  });

  return result.docs.map((event) =>
    transformPayloadEventToBreweryEvent(event)
  );
}

export default async function EventsPage() {
  const [events, locations] = await Promise.all([
    getEvents(),
    getAllLocations(),
  ]);
  const locationLookup = createLocationLookup(locations);

  const jsonLd = events.length > 0 ? generateEventListJsonLd(events, locationLookup) : null;

  return (
    <>
      {/* JSON-LD structured data for all locations */}
      {jsonLd && <JsonLd data={jsonLd} />}

      <EventsPageClient initialEvents={events} />
    </>
  );
}
