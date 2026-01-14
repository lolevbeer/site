'use client';

import React, { useMemo } from 'react';
import { BreweryEvent } from '@/lib/types/event';
import type { LocationFilter } from '@/lib/types/location';
import { EventList } from '@/components/events/event-list';
import { Button } from '@/components/ui/button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Calendar } from 'lucide-react';
import { useLocationContext } from '@/components/location/location-provider';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';

interface EventsPageClientProps {
  initialEvents: BreweryEvent[];
}

export function EventsPageClient({ initialEvents }: EventsPageClientProps) {
  const { currentLocation, locations } = useLocationContext();
  const locationFilter = currentLocation as LocationFilter;

  const handleEventClick = (event: BreweryEvent) => {
    if (event.site) {
      window.open(event.site, '_blank');
    }
  };

  // Filter events by location
  const filteredEvents = useMemo(() => {
    return locationFilter === 'all'
      ? initialEvents
      : initialEvents.filter(event => event.location === locationFilter);
  }, [initialEvents, locationFilter]);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageBreadcrumbs className="mb-6" />
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Events</h1>
      </div>

      {filteredEvents.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Calendar className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>No Upcoming Events</EmptyTitle>
            <EmptyDescription>
              {locationFilter !== 'all'
                ? `No upcoming events at ${locations.find(l => (l.slug || l.id) === locationFilter)?.name || locationFilter}. Check back soon!`
                : 'No upcoming events scheduled. Check back soon for live music, trivia, and more!'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
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
  );
}
