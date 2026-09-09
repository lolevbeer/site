'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { BreweryEvent } from '@/lib/types/event';
import type { LocationFilter } from '@/lib/types/location';
import { Button } from '@/components/ui/button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Calendar } from '@/components/icons';
import { useLocationContext } from '@/components/location/location-provider';
import { getLocationDisplayName } from '@/lib/config/locations';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { ScheduleList } from '@/components/ui/schedule-list';
import { isTodayOrFuture } from '@/lib/utils/formatters';
import { safeHttpUrl } from '@/lib/utils/url-utils';

interface EventsPageClientProps {
  initialEvents: BreweryEvent[];
}

export function EventsPageClient({ initialEvents }: EventsPageClientProps) {
  const { currentLocation, locations } = useLocationContext();
  const locationFilter = currentLocation as LocationFilter;

  // Filter events by location and sort by date
  const filteredEvents = useMemo(() => {
    const filtered = locationFilter === 'all'
      ? initialEvents
      : initialEvents.filter(event => event.location === locationFilter);

    return filtered
      .filter(event => isTodayOrFuture(event.date))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [initialEvents, locationFilter]);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageBreadcrumbs className="mb-6" />
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Events</h1>
      </div>

      <div className="max-w-2xl mx-auto">
        <h2 className="sr-only">Upcoming events</h2>
        {filteredEvents.length > 0 ? (
          <ScheduleList
            items={filteredEvents.map((event) => ({
              id: String(event.id ?? `${event.title}-${event.date}-${event.location}-${event.time}`),
              date: event.date,
              title: event.title,
              time: event.time,
              endTime: event.endTime,
              locationName:
                locationFilter === 'all'
                  ? getLocationDisplayName(locations, event.location)
                  : undefined,
              description:
                event.description !== event.title ? event.description : undefined,
              site: safeHttpUrl(event.site),
            }))}
          />
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Calendar className="h-6 w-6" />
              </EmptyMedia>
              <EmptyTitle>No Upcoming Events</EmptyTitle>
              <EmptyDescription>
                {locationFilter === 'all'
                  ? 'No upcoming events scheduled. Check back soon for live music, trivia, and more!'
                  : `No upcoming events at ${getLocationDisplayName(locations, locationFilter)}. Check back soon!`}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>

      <div className="text-center space-y-3 pt-12 mt-12">
        <h2 className="text-lg font-semibold">Book a private event</h2>
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
        <p className="text-sm text-muted-foreground pt-6">
          Asking us to donate beer? Use the{' '}
          <Link href="/donate" className="underline hover:text-foreground">
            donation request form
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
