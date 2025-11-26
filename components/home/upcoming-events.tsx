'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EventCard } from '@/components/events/event-card';
import { parseLocalDate } from '@/lib/utils/formatters';
import { useLocationFilteredData } from '@/lib/hooks/use-location-filtered-data';

interface Event {
  date: string;
  vendor: string;
  time?: string;
  attendees?: string;
  site?: string;
  end?: string;
}

interface UpcomingEventsProps {
  lawrencevilleEvents: Event[];
  zelienopleEvents: Event[];
}

export function UpcomingEvents({ lawrencevilleEvents, zelienopleEvents }: UpcomingEventsProps) {
  // Filter by location first
  const filteredEvents = useLocationFilteredData({
    lawrencevilleData: lawrencevilleEvents,
    zelienopleData: zelienopleEvents
  });

  // Sort and take first 3
  const upcomingEvents = useMemo(() => {
    const eventsWithLocation = filteredEvents.map((e) => {
      // Determine location based on which array the item came from
      const isFromLawrenceville = lawrencevilleEvents.includes(e as Event);
      return {
        ...e,
        location: isFromLawrenceville ? 'lawrenceville' as const : 'zelienople' as const
      };
    });

    eventsWithLocation.sort((a, b) => {
      const dateA = parseLocalDate(a.date);
      const dateB = parseLocalDate(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    return eventsWithLocation.slice(0, 3);
  }, [filteredEvents, lawrencevilleEvents]);

  return (
    <section className="py-16 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 flex justify-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Upcoming Events
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 justify-items-center">
          {upcomingEvents.map((event, index) => (
            <EventCard
              key={index}
              event={event}
              currentLocation={event.location}
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
