'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { BreweryEvent, EventType, EventStatus } from '@/lib/types/event';
import type { LocationFilter, LocationSlug } from '@/lib/types/location';
import { EventList } from '@/components/events/event-list';
import { Button } from '@/components/ui/button';
import { useLocationContext } from '@/components/location/location-provider';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { generateEventListJsonLd } from '@/lib/utils/json-ld';

interface EventsPageContentProps {
  initialEvents?: BreweryEvent[];
}

/**
 * Fetch events from Payload API for all locations
 */
async function fetchEventsFromPayload(): Promise<BreweryEvent[]> {
  try {
    // Get today's date at midnight for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    // Fetch all public events from today onwards using Payload REST API
    const params = new URLSearchParams({
      'where[visibility][equals]': 'public',
      'where[date][greater_than_equal]': todayStr,
      sort: 'date',
      limit: '100',
      depth: '1',
    });

    const response = await fetch(`/api/events?${params.toString()}`);
    if (!response.ok) {
      console.error('Failed to fetch events:', response.status);
      return [];
    }

    const data = await response.json();
    const events = data.docs || [];

    // Transform Payload events to BreweryEvent format
    return events.map((event: { id: string; vendor: string; description?: string; date: string; time?: string; endTime?: string; location?: { slug?: string } | string; site?: string; attendees?: number }) => {
      const locationSlug = typeof event.location === 'object'
        ? event.location?.slug
        : undefined;

      return {
        id: event.id,
        title: event.vendor,
        description: event.description || event.vendor,
        date: event.date.split('T')[0],
        time: event.time || '',
        endTime: event.endTime,
        vendor: event.vendor,
        type: EventType.SPECIAL_EVENT,
        status: EventStatus.SCHEDULED,
        location: locationSlug as LocationSlug,
        site: event.site,
        attendees: event.attendees,
      };
    });
  } catch (error) {
    console.error('Error fetching events from Payload:', error);
    return [];
  }
}

export function EventsPageContent({ initialEvents = [] }: EventsPageContentProps) {
  const { currentLocation, locations } = useLocationContext();
  // Cast to LocationFilter to allow comparison with 'all'
  const locationFilter = currentLocation as LocationFilter;
  const [events, setEvents] = useState<BreweryEvent[]>(initialEvents);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const payloadEvents = await fetchEventsFromPayload();
        setEvents(payloadEvents);
      } catch (error) {
        console.error('Error loading events:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);
  const handleEventClick = (event: BreweryEvent) => {
    if (event.site) {
      window.open(event.site, '_blank');
    }
  };

  // Filter events by location with useMemo to ensure proper updates
  const filteredEvents = useMemo(() => {
    return locationFilter === 'all'
      ? events
      : events.filter(event => event.location === locationFilter);
  }, [events, locationFilter]);

  return (
    <>
      {/* Add JSON-LD structured data for SEO */}
      {!loading && filteredEvents.length > 0 && (
        <JsonLd data={generateEventListJsonLd(filteredEvents)} />
      )}

      <div className="container mx-auto px-4 py-8">
        <PageBreadcrumbs className="mb-6" />
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Events</h1>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading events...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-lg font-semibold mb-2">No Upcoming Events</h3>
            <p className="text-muted-foreground">
              {locationFilter !== 'all'
                ? `No upcoming events at ${locations.find(l => (l.slug || l.id) === locationFilter)?.name || locationFilter}. Check back soon!`
                : 'No upcoming events scheduled. Check back soon for live music, trivia, and more!'}
            </p>
          </div>
        ) : (
          <EventList
            key={`events-${currentLocation}`}
            events={filteredEvents}
            onEventClick={handleEventClick}
            showLocationFilter={false}
            showFilters={false}
          />
        )}

        <div className="text-center space-y-3 pt-12 mt-12">
          <h2 className="text-lg font-semibold">Book Private Event</h2>
          <div className="flex justify-center gap-4 flex-wrap">
            <Button variant="ghost" size="sm" asChild>
              <a href="mailto:events@lolev.beer">
                events@lolev.beer
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="tel:4123368965">
                (412) 336-8965
              </a>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}