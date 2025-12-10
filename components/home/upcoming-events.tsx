'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EventCard } from '@/components/events/event-card';
import { parseLocalDate } from '@/lib/utils/formatters';
import { useLocationFilteredData, type LocationData } from '@/lib/hooks/use-location-filtered-data';
import { Pencil } from 'lucide-react';
import type { LocationSlug } from '@/lib/types/location';

interface Event {
  date: string;
  vendor: string;
  time?: string;
  attendees?: string;
  site?: string;
  end?: string;
  location?: LocationSlug;
}

interface UpcomingEventsProps {
  /** Events organized by location slug */
  eventsByLocation: Record<string, Event[]>;
  isAuthenticated?: boolean;
}

export function UpcomingEvents({ eventsByLocation, isAuthenticated }: UpcomingEventsProps) {
  // Add location to each event
  const _eventsWithLocation = useMemo(() => {
    const allEvents: (Event & { location: LocationSlug })[] = [];
    for (const [locationSlug, events] of Object.entries(eventsByLocation)) {
      for (const event of events) {
        allEvents.push({ ...event, location: locationSlug });
      }
    }
    return allEvents;
  }, [eventsByLocation]);

  // Create data structure for location filtering
  const dataByLocation = useMemo(() => {
    const result: LocationData<Event & { location: LocationSlug }> = {};
    for (const [locationSlug, events] of Object.entries(eventsByLocation)) {
      result[locationSlug] = events.map(e => ({ ...e, location: locationSlug }));
    }
    return result;
  }, [eventsByLocation]);

  // Filter by current location
  const filteredEvents = useLocationFilteredData({ dataByLocation });

  // Sort and take first 3
  const upcomingEvents = useMemo(() => {
    const sorted = [...filteredEvents].sort((a, b) => {
      const dateA = parseLocalDate(a.date);
      const dateB = parseLocalDate(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    return sorted.slice(0, 3);
  }, [filteredEvents]);

  return (
    <section className="py-16 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1" />
            <h2 className="text-3xl lg:text-4xl font-bold">
              Upcoming Events
            </h2>
            <div className="flex-1 flex justify-end">
              {isAuthenticated && (
                <Button asChild variant="outline" size="sm">
                  <a href="/admin/collections/events" target="_blank" rel="noopener noreferrer">
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </a>
                </Button>
              )}
            </div>
          </div>
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
