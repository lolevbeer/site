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
  const { locations } = useLocationContext();

  const hasBeers = beerCount && Object.values(beerCount).some(n => n > 0);

  // Format next event date using EST timezone
  const formatEventDate = (dateStr: string) => {
    const todayEST = getTodayEST();
    const eventDateStr = dateStr.split('T')[0];

    const todayDate = new Date(todayEST);
    const eventDate = new Date(eventDateStr);
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
      {/* On Tap Now Card */}
      <MotionCard glow className="h-full">
        <Link href="/beer" className="group block h-full">
          <Card className="p-6 lg:p-8 h-full transition-colors cursor-pointer shadow-none bg-transparent border border-border hover:bg-secondary/50 relative text-center flex flex-col items-center justify-center">
            <h3 className="text-3xl lg:text-4xl font-bold mb-5">On Tap Now</h3>
            {hasBeers ? (
              <div className="flex items-center justify-center gap-6">
                {locations.map(location => {
                  const slug = location.slug || location.id;
                  const count = beerCount?.[slug];
                  if (count === undefined) return null;
                  return (
                    <div key={slug} className="flex flex-col items-center gap-1">
                      <div className="text-4xl lg:text-5xl font-bold tabular-nums">{count}</div>
                      <div className="text-sm text-muted-foreground font-medium">{location.name}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Explore our current selection
              </p>
            )}
          </Card>
        </Link>
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
