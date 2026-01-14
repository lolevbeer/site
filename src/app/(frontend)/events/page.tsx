/**
 * Events Page
 * Server component with JSON-LD for all locations
 */

import { Metadata } from 'next';
import { getPayload } from 'payload';
import config from '@/src/payload.config';
import { JsonLd } from '@/components/seo/json-ld';
import { EventsPageClient } from './events-page-client';
import { BreweryEvent, EventType, EventStatus } from '@/lib/types/event';
import type { LocationSlug } from '@/lib/types/location';

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

interface PayloadEvent {
  id: string;
  organizer: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: { slug?: string; name?: string; id?: string } | string;
  site?: string;
  attendees?: number;
  visibility?: string;
}

/**
 * Fetch events server-side
 */
async function getEvents(): Promise<BreweryEvent[]> {
  const payload = await getPayload({ config });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await payload.find({
    collection: 'events',
    where: {
      visibility: { equals: 'public' },
      date: { greater_than_equal: today.toISOString() },
    },
    sort: 'date',
    limit: 100,
    depth: 1,
  });

  return (result.docs as PayloadEvent[]).map((event) => {
    const locationSlug = typeof event.location === 'object'
      ? event.location?.slug
      : undefined;
    const locationName = typeof event.location === 'object'
      ? event.location?.name
      : undefined;

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
      location: locationSlug as LocationSlug,
      locationName,
      site: event.site,
      attendees: event.attendees,
    };
  });
}

/**
 * Generate JSON-LD for events
 */
function generateEventsJsonLd(events: BreweryEvent[]) {
  if (events.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: events.map((event, index) => {
      const locationName = event.locationName ||
        (event.location === 'lawrenceville' ? 'Lolev Beer - Lawrenceville' : 'Lolev Beer - Zelienople');

      const locationAddress = event.location === 'lawrenceville'
        ? '115 43rd St, Pittsburgh, PA 15201'
        : '148 S Main St, Zelienople, PA 16063';

      return {
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Event',
          name: event.title,
          description: event.description,
          startDate: event.time
            ? `${event.date}T${event.time}`
            : event.date,
          ...(event.endTime && { endDate: `${event.date}T${event.endTime}` }),
          eventStatus: 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          location: {
            '@type': 'Place',
            name: locationName,
            address: {
              '@type': 'PostalAddress',
              streetAddress: locationAddress,
            },
          },
          organizer: {
            '@type': 'Organization',
            name: 'Lolev Beer',
            url: 'https://lolev.beer',
          },
          ...(event.site && { url: event.site }),
        },
      };
    }),
  };
}

export default async function EventsPage() {
  const events = await getEvents();
  const jsonLd = generateEventsJsonLd(events);

  return (
    <>
      {/* JSON-LD structured data for all locations */}
      {jsonLd && <JsonLd data={jsonLd} />}

      <EventsPageClient initialEvents={events} />
    </>
  );
}
