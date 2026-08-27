'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import type { LocationSlug } from '@/lib/types/location';
import { cn } from '@/lib/utils';
import { getTodayEST, getDayOfWeekEST, toESTDate } from '@/lib/utils/date';
import { useLocationContext } from '@/components/location/location-provider';
import { getLocationDisplayName } from '@/lib/config/locations';
import { MotionCard } from '@/components/motion';

interface QuickInfoCardsProps {
  beerCount?: Record<string, number>;
  nextEvent?: { name: string; date: string; location: LocationSlug } | null;
  className?: string;
}

export function QuickInfoCards({ beerCount, nextEvent, className }: QuickInfoCardsProps) {
  const { locations, currentLocation } = useLocationContext();

  // One entry per location that reported a count, so the tiles and the
  // "any beers at all" check cannot disagree.
  const countedLocations = locations
    .map(location => {
      const slug = location.slug || location.id;
      return { location, slug, count: beerCount?.[slug] };
    })
    .filter((entry): entry is { location: typeof entry.location; slug: string; count: number } =>
      entry.count !== undefined
    );
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
      {/* On Tap Now Card. Each location is its own link rather than the whole
          card, so it is obvious you are picking one taproom or the other: the
          `loc` param switches the location context (see use-location) and the
          `#draft` hash lands on that location's draft list further down. */}
      <MotionCard glow className="h-full">
        <Card className="p-6 lg:p-8 h-full shadow-none bg-transparent border border-border relative text-center flex flex-col items-center justify-center">
          <h3 className="text-3xl lg:text-4xl font-bold mb-5">On Tap Now</h3>
          {hasBeers ? (
            <>
              <div className="flex items-stretch justify-center">
                {countedLocations.map(({ location, slug, count }, index) => {
                  const isCurrent = slug === currentLocation;
                  return (
                    <Link
                      key={slug}
                      href={`/?loc=${slug}#draft`}
                      aria-label={`See the ${count} beers on tap at ${location.name}`}
                      className={cn(
                        'group flex flex-col items-center gap-1 px-6 py-2 transition-colors hover:bg-secondary/50 active:bg-secondary',
                        // Explicit border rather than divide-x: this Tailwind
                        // setup does not emit the divide-* utilities.
                        index > 0 && 'border-l border-border',
                        isCurrent && 'bg-secondary/40'
                      )}
                      suppressHydrationWarning
                    >
                      <div className="text-4xl lg:text-5xl font-bold tabular-nums">{count}</div>
                      <div className="text-sm text-muted-foreground font-medium group-hover:text-foreground transition-colors">
                        {location.name}
                      </div>
                    </Link>
                  );
                })}
              </div>
              <Link
                href="/beer"
                className="mt-5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                See all beers &rarr;
              </Link>
            </>
          ) : (
            <Link
              href="/beer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Explore our current selection
            </Link>
          )}
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
