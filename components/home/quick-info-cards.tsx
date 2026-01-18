'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { LocationSlug } from '@/lib/types/location';
import { cn } from '@/lib/utils';
import { getTodayEST, getDayOfWeekEST, toESTDate } from '@/lib/utils/date';
import { useLocationContext } from '@/components/location/location-provider';

interface QuickInfoCardsProps {
  beerCount?: Record<string, number>;
  nextEvent?: { name: string; date: string; location: LocationSlug } | null;
  className?: string;
}

export function QuickInfoCards({ beerCount, nextEvent, className }: QuickInfoCardsProps) {
  const { locations } = useLocationContext();

  // Get location name from slug
  const getLocationName = (slug: LocationSlug): string => {
    const location = locations.find(loc => (loc.slug || loc.id) === slug);
    return location?.name || slug;
  };

  // Format next event date using EST timezone
  const formatEventDate = (dateStr: string) => {
    const todayEST = getTodayEST();
    const eventDateStr = dateStr.split('T')[0]; // Get YYYY-MM-DD part

    // Calculate day difference
    const todayDate = new Date(todayEST);
    const eventDate = new Date(eventDateStr);
    const diffDays = Math.floor((eventDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) {
      const dayName = getDayOfWeekEST(eventDateStr);
      return dayName;
    }

    // Format as "Mon 15" or "Jan 15"
    const date = toESTDate(eventDateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  };

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", className)}>
      {/* On Tap Now Card */}
      <Link href="/beer" className="group">
        <Card className="p-6 lg:p-8 h-full transition-all cursor-pointer shadow-none text-center bg-transparent border border-border hover:bg-secondary relative">
          <div className="flex items-center justify-center gap-2 mb-4">
            <h3 className="text-3xl lg:text-4xl font-bold">On Tap Now</h3>
            <ArrowRight className="h-6 w-6 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
          </div>
          {beerCount && Object.keys(beerCount).length > 0 ? (
            <div className="text-sm text-muted-foreground space-y-2">
              {locations.map(location => {
                const slug = location.slug || location.id;
                const count = beerCount[slug];
                if (count === undefined) return null;
                return (
                  <div key={slug} className="text-center">
                    <div className="text-lg font-medium text-foreground">{location.name}</div>
                    <div>{count} beers</div>
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

      {/* Next Event Card */}
      <Link href="/events" className="group">
        <Card className="p-6 lg:p-8 h-full transition-all cursor-pointer shadow-none text-center bg-transparent border border-border hover:bg-secondary relative">
          <div className="flex items-center justify-center gap-2 mb-4">
            <h3 className="text-3xl lg:text-4xl font-bold">{nextEvent ? 'Next Event' : 'Upcoming Events'}</h3>
            <ArrowRight className="h-6 w-6 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
          </div>
          {nextEvent ? (
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="text-lg font-medium text-foreground line-clamp-2">{nextEvent.name}</p>
              <p>{formatEventDate(nextEvent.date)} at {getLocationName(nextEvent.location)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Check out our event calendar
            </p>
          )}
        </Card>
      </Link>
    </div>
  );
}
