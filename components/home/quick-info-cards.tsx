'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import type { LocationSlug } from '@/lib/types/location';
import { cn } from '@/lib/utils';
import { getTodayEST, getDayOfWeekEST, toESTDate } from '@/lib/utils/date';
import { useLocationContext } from '@/components/location/location-provider';
import { getLocationDisplayName } from '@/lib/config/locations';
import {
  SEGMENTED_ITEM_IDLE_CLASS,
  SEGMENTED_ITEM_SELECTED_CLASS,
  SEGMENTED_TROUGH_CLASS,
} from '@/components/location/location-tabs';
import { MotionCard } from '@/components/motion';

interface QuickInfoCardsProps {
  beerCount?: Record<string, number>;
  nextEvent?: { name: string; date: string; location: LocationSlug } | null;
  className?: string;
}

export function QuickInfoCards({ beerCount, nextEvent, className }: QuickInfoCardsProps) {
  const { locations, currentLocation, setLocation } = useLocationContext();

  // One entry per location that reported a count, so the tiles and the
  // "any beers at all" check cannot disagree.
  const countedLocations = locations.flatMap(location => {
    const slug = location.slug || location.id;
    const count = beerCount?.[slug];
    return count === undefined ? [] : [{ location, slug, count }];
  });
  const hasBeers = countedLocations.some(({ count }) => count > 0);

  // Format next event date using EST timezone
  const formatEventDate = (dateStr: string) => {
    const todayEST = getTodayEST();
    const eventDateStr = dateStr.split('T')[0];

    const todayDate = toESTDate(todayEST);
    const eventDate = toESTDate(eventDateStr);
    const diffDays = Math.floor((eventDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) {
      return getDayOfWeekEST(eventDateStr);
    }

    const date = toESTDate(eventDateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  };

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", className)}>
      {/* On Tap Now Card. Each location is its own target rather than the whole
          card, so it is obvious you are picking one taproom or the other. */}
      <MotionCard glow className="h-full">
        <Card className="p-6 lg:p-8 h-full shadow-none bg-transparent border border-border relative text-center flex flex-col items-center justify-center">
          <h3 className="text-3xl lg:text-4xl font-bold mb-5">On Tap Now</h3>
          {hasBeers && (
            <div className={cn('inline-grid grid-flow-col auto-cols-fr', SEGMENTED_TROUGH_CLASS)}>
              {countedLocations.map(({ location, slug, count }) => {
                const isActive = slug === currentLocation;
                return (
                  <a
                    key={slug}
                    href="#draft"
                    onClick={() => setLocation(slug)}
                    aria-label={`See the ${count} beers on tap at ${location.name}`}
                    aria-current={isActive ? 'true' : undefined}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-sm px-6 py-3 transition-colors',
                      isActive ? SEGMENTED_ITEM_SELECTED_CLASS : SEGMENTED_ITEM_IDLE_CLASS
                    )}
                  >
                    <div className="text-4xl lg:text-5xl font-bold tabular-nums">{count}</div>
                    <div className="text-sm font-medium">{location.name}</div>
                  </a>
                );
              })}
            </div>
          )}
          <Link
            href="/beer"
            className={cn(
              'text-sm text-muted-foreground hover:text-foreground transition-colors',
              hasBeers && 'mt-5'
            )}
          >
            {hasBeers ? <>See all beers &rarr;</> : 'Explore our current selection'}
          </Link>
        </Card>
      </MotionCard>

      {/* Next Event Card */}
      <MotionCard glow className="h-full">
        <Link href="/events" className="group block h-full">
          <Card className="p-6 lg:p-8 h-full transition-colors cursor-pointer shadow-none bg-transparent border border-border hover:bg-secondary/50 relative text-center flex flex-col items-center justify-center">
            <h3 className="text-3xl lg:text-4xl font-bold mb-5">{nextEvent ? 'Next Event' : 'Upcoming Events'}</h3>
            {nextEvent ? (
              <div className="flex flex-col items-center gap-1">
                <p className="text-lg font-semibold text-foreground line-clamp-2 leading-tight">{nextEvent.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatEventDate(nextEvent.date)} · {getLocationDisplayName(locations, nextEvent.location)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Check out our event calendar
              </p>
            )}
          </Card>
        </Link>
      </MotionCard>
    </div>
  );
}
