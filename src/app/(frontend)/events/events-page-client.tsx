'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { BreweryEvent } from '@/lib/types/event';
import type { LocationFilter } from '@/lib/types/location';
import { Button } from '@/components/ui/button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Calendar } from '@/components/icons';
import { useLocationContext } from '@/components/location/location-provider';
import { getLocationDisplayName } from '@/lib/config/locations';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { EventInquiryForm } from '@/components/events/event-inquiry-form';
import { HubIntro } from '@/components/ui/hub-intro'
import { ScheduleList } from '@/components/ui/schedule-list';
import { TimelineItem } from '@/components/ui/timeline-item';
import { formatDate, isTodayOrFuture } from '@/lib/utils/formatters';
import { safeHttpUrl } from '@/lib/utils/url-utils';
import { eventBadge, regularLabel, splitRegulars } from '@/lib/utils/event-regulars';
import { useTodayEST } from '@/lib/hooks/use-today-est';

/**
 * Row anchor id. CMS and recurring ids are already URL-safe; the rare id-less
 * event gets a slug so `#event-<id>` stays a valid fragment.
 */
function eventAnchorId(event: BreweryEvent): string {
  if (event.id) return String(event.id);
  return `${event.title}-${event.date}-${event.location}-${event.time}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Shared links look like /events?loc=<slug>#event-<id>. The server renders the
 * default taproom, so a row at another taproom only appears after hydration
 * applies `?loc=`; the browser's own hash jump has already missed it. Scroll
 * once, the first time the target row exists.
 */
function useScrollToHashOnce(rowsKey: unknown) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    const hash = window.location.hash.slice(1);
    if (!hash.startsWith('event-')) {
      done.current = true;
      return;
    }
    const target = document.getElementById(decodeURIComponent(hash));
    if (!target) return;
    done.current = true;
    target.scrollIntoView();
  }, [rowsKey]);
}

interface EventsPageClientProps {
  /** CMS intro paragraph shown under the heading. */
  intro?: string
  initialEvents: BreweryEvent[];
}

export function EventsPageClient({ initialEvents, intro }: EventsPageClientProps) {
  const { currentLocation, locations } = useLocationContext();
  const locationFilter = currentLocation as LocationFilter;
  // The server list is already upcoming-only. Past days are dropped only once
  // mounted, so HTML cached before midnight hydrates without a mismatch.
  const today = useTodayEST();

  // Filter events by location and sort by date
  const filteredEvents = useMemo(() => {
    const filtered = locationFilter === 'all'
      ? initialEvents
      : initialEvents.filter(event => event.location === locationFilter);

    return filtered
      .filter(event => today === null || isTodayOrFuture(event.date, today))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [initialEvents, locationFilter, today]);

  // Weekly regulars collapse into one block so one-offs stand out. The page's
  // JSON-LD still lists every occurrence.
  const { oneOffs, regulars } = useMemo(() => splitRegulars(filteredEvents), [filteredEvents]);

  useScrollToHashOnce(filteredEvents);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageBreadcrumbs className="mb-6" />
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Events</h1>
        <HubIntro text={intro} />
      </div>

      <div className="max-w-2xl mx-auto">
        <h2 className="sr-only">Upcoming events</h2>
        {filteredEvents.length > 0 ? (
          <>
          <ScheduleList
            calendar
            anchors
            items={oneOffs.map((event) => ({
              // No description: the CMS field is internal and never reaches this page.
              id: eventAnchorId(event),
              date: event.date,
              title: event.title,
              time: event.time,
              endTime: event.endTime,
              locationName:
                locationFilter === 'all'
                  ? getLocationDisplayName(locations, event.location)
                  : undefined,
              site: safeHttpUrl(event.site),
              badge: eventBadge(event.tags),
            }))}
          />
          {regulars.length > 0 ? (
            <section className={`text-center ${oneOffs.length > 0 ? 'mt-12' : ''}`}>
              <h3 className="text-lg font-semibold tracking-tight mb-3">Regulars</h3>
              <ul className="space-y-3 list-none p-0 m-0">
                {regulars.map(({ next, occurrenceIds }) => (
                  <li key={occurrenceIds[0]} className="py-2">
                    {/* Keep each occurrence's anchor so Event JSON-LD links land here. */}
                    {occurrenceIds.map((id) => (
                      <span key={id} id={`event-${id}`} className="block scroll-mt-20" />
                    ))}
                    <TimelineItem
                      title={regularLabel(next)}
                      location={`${
                        locationFilter === 'all'
                          ? `${getLocationDisplayName(locations, next.location)} · `
                          : ''
                      }next ${formatDate(next.date, 'short')}`}
                      site={next.site}
                      calendarHref={`/events/${encodeURIComponent(occurrenceIds[0])}/calendar.ics`}
                      className="py-0"
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          </>
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
        <EventInquiryForm taprooms={locations.filter((location) => location.active !== false)} />
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
