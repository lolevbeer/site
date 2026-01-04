'use client';

import React, { useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { EventCard } from '@/components/events/event-card';
import { parseLocalDate } from '@/lib/utils/formatters';
import { useLocationFilteredData, type LocationData } from '@/lib/hooks/use-location-filtered-data';
import { useSortedItems } from '@/lib/hooks/use-sorted-items';
import type { Event as PayloadEvent } from '@/src/payload-types';

type EventWithLocationSlug = PayloadEvent & { locationSlug: string };

interface UpcomingEventsProps {
  /** Events organized by location slug */
  eventsByLocation: Record<string, PayloadEvent[]>;
  isAuthenticated?: boolean;
}

export function UpcomingEvents({ eventsByLocation, isAuthenticated }: UpcomingEventsProps) {
  // Create data structure for location filtering
  const dataByLocation = useMemo(() => {
    const result: LocationData<EventWithLocationSlug> = {};
    for (const [slug, events] of Object.entries(eventsByLocation)) {
      result[slug] = events.map(e => ({ ...e, locationSlug: slug }));
    }
    return result;
  }, [eventsByLocation]);

  // Filter by current location
  const filteredEvents = useLocationFilteredData({ dataByLocation });

  // Date parser for events (uses parseLocalDate for proper timezone handling)
  const getEventDate = useCallback((e: EventWithLocationSlug) => parseLocalDate(e.date), []);

  // Sort and take first 3
  const upcomingEvents = useSortedItems(filteredEvents, {
    getDate: getEventDate,
    limit: 3,
  });

  if (upcomingEvents.length === 0) {
    return null;
  }

  return (
    <section className="py-16 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title="Upcoming Events"
          adminUrl="/admin/collections/events"
          isAuthenticated={isAuthenticated}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 justify-items-center">
          {upcomingEvents.map((event, index) => (
            <EventCard
              key={index}
              event={event}
              currentLocation={event.locationSlug}
            />
          ))}
        </div>

        <div className="text-center">
          <Button asChild variant="outline" size="lg">
            <Link href="/events">
              View All
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
