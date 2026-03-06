'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
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

/** Stylized calendar chip showing month + day */
function CalendarChip({ dateStr }: { dateStr: string }) {
  const date = toESTDate(dateStr.split('T')[0]);
  const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'America/New_York' });
  const day = date.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/New_York' });

  return (
    <div className="flex flex-col items-center rounded-lg border border-border overflow-hidden w-14 flex-shrink-0">
      <div className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider w-full text-center py-0.5">
        {month}
      </div>
      <div className="text-2xl font-bold py-1">
        {day}
      </div>
    </div>
  );
}

export function QuickInfoCards({ beerCount, nextEvent, className }: QuickInfoCardsProps) {
  const { locations } = useLocationContext();

  const totalBeers = beerCount
    ? Object.values(beerCount).reduce((sum, n) => sum + n, 0)
    : 0;

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
      <MotionCard glow>
        <Link href="/beer" className="group block">
          <Card className="p-6 lg:p-8 h-full transition-colors cursor-pointer shadow-none bg-transparent border border-border hover:bg-secondary/50 relative">
            <div className="flex items-center justify-center gap-2 mb-5">
              <h3 className="text-3xl lg:text-4xl font-bold">On Tap Now</h3>
              <ArrowRight className="h-6 w-6 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
            </div>
            {totalBeers > 0 ? (
              <div className="flex flex-col items-center gap-3">
                <div className="text-5xl lg:text-6xl font-bold tabular-nums">{totalBeers}</div>
                <div className="text-sm text-muted-foreground font-medium">beers on tap</div>
                <div className="flex items-center justify-center gap-4 mt-1">
                  {locations.map(location => {
                    const slug = location.slug || location.id;
                    const count = beerCount?.[slug];
                    if (count === undefined) return null;
                    return (
                      <div key={slug} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{count}</span>
                        <span>{location.name}</span>
                      </div>
                    );
                  })}
                </div>
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
      <MotionCard glow>
        <Link href="/events" className="group block">
          <Card className="p-6 lg:p-8 h-full transition-colors cursor-pointer shadow-none bg-transparent border border-border hover:bg-secondary/50 relative">
            <div className="flex items-center justify-center gap-2 mb-5">
              <h3 className="text-3xl lg:text-4xl font-bold">{nextEvent ? 'Next Event' : 'Upcoming Events'}</h3>
              <ArrowRight className="h-6 w-6 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
            </div>
            {nextEvent ? (
              <div className="flex items-center justify-center gap-4">
                <CalendarChip dateStr={nextEvent.date} />
                <div className="text-left">
                  <p className="text-lg font-semibold text-foreground line-clamp-2 leading-tight">{nextEvent.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatEventDate(nextEvent.date)} at {getLocationDisplayName(locations, nextEvent.location)}
                  </p>
                </div>
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
