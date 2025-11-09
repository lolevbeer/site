'use client';

import React from 'react';
import Link from 'next/link';
import { Beer, Clock, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Location } from '@/lib/types/location';
import { getLocationInfo, isLocationOpen, getFormattedHours } from '@/lib/config/locations';
import { cn } from '@/lib/utils';
import { getTodayEST, getDayOfWeekEST, toESTDate } from '@/lib/utils/date';

interface QuickInfoCardsProps {
  beerCount?: { lawrenceville: number; zelienople: number };
  nextEvent?: { name: string; date: string; location: Location } | null;
  className?: string;
}

export function QuickInfoCards({ beerCount, nextEvent, className }: QuickInfoCardsProps) {
  // Get current day in EST timezone
  const todayEST = getTodayEST();
  const currentDay = getDayOfWeekEST(todayEST).toLowerCase();

  // Get hours for both locations
  const lawrencevilleInfo = getLocationInfo(Location.LAWRENCEVILLE);
  const zelienopleInfo = getLocationInfo(Location.ZELIENOPLE);
  const lawrencevilleHours = getFormattedHours(Location.LAWRENCEVILLE, currentDay as keyof typeof lawrencevilleInfo.hours);
  const zelienopleHours = getFormattedHours(Location.ZELIENOPLE, currentDay as keyof typeof zelienopleInfo.hours);

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
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4", className)}>
      {/* On Tap Now Card */}
      <Link href="/beer" className="group">
        <Card className="p-5 h-full transition-colors cursor-pointer border-0 hover:bg-secondary shadow-none text-center bg-transparent dark:bg-transparent">
          <div className="flex items-center justify-center gap-3 mb-3">
            <h3 className="text-xl font-bold">On Tap Now</h3>
          </div>
          {beerCount ? (
            <div className="text-sm text-muted-foreground space-y-2">
              <div className="text-center">
                <div className="text-lg font-medium text-foreground">Lawrenceville</div>
                <div>{beerCount.lawrenceville} beers</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-medium text-foreground">Zelienople</div>
                <div>{beerCount.zelienople} beers</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Explore our current selection
            </p>
          )}
        </Card>
      </Link>

      {/* Hours Today Card */}
      <Link href="/beer-map" className="group">
        <Card className="p-5 h-full transition-colors cursor-pointer border-0 hover:bg-secondary shadow-none text-center bg-transparent dark:bg-transparent">
          <div className="flex items-center justify-center gap-3 mb-3">
            <h3 className="text-xl font-bold">Hours Today</h3>
          </div>
          <div className="text-sm text-muted-foreground space-y-2">
            <div className="text-center">
              <div className="text-lg font-medium text-foreground">Lawrenceville</div>
              <div>{lawrencevilleHours}</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-medium text-foreground">Zelienople</div>
              <div>{zelienopleHours}</div>
            </div>
          </div>
        </Card>
      </Link>

      {/* Next Event Card */}
      <Link href="/events" className="group">
        <Card className="p-5 h-full transition-colors cursor-pointer border-0 hover:bg-secondary shadow-none text-center bg-transparent dark:bg-transparent">
          <div className="flex items-center justify-center gap-3 mb-3">
            <h3 className="text-2xl font-bold">
              {nextEvent ? 'Next Event' : 'Upcoming Events'}
            </h3>
          </div>
          {nextEvent ? (
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="text-lg font-medium text-foreground line-clamp-2">{nextEvent.name}</p>
              <p>{formatEventDate(nextEvent.date)} at {nextEvent.location === Location.LAWRENCEVILLE ? 'Lawrenceville' : 'Zelienople'}</p>
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
