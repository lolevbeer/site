'use client';

import React from 'react';
import Link from 'next/link';
import { Beer, Clock, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Location } from '@/lib/types/location';
import { cn } from '@/lib/utils';
import { getTodayEST, getDayOfWeekEST, toESTDate } from '@/lib/utils/date';
import type { WeeklyHoursDay, DayOfWeek } from '@/lib/utils/payload-api';

function formatTime(time: string | null, timezone: string = 'America/New_York'): string {
  if (!time) return '';
  if (time.includes('T')) {
    const date = new Date(time);
    const minutes = date.getMinutes();
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: minutes === 0 ? undefined : '2-digit',
      hour12: true,
      timeZone: timezone,
    });
  }
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  if (minutes === 0) {
    return `${displayHours} ${ampm}`;
  }
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function formatHoursString(dayData: WeeklyHoursDay): string {
  if (dayData.closed) return 'Closed';
  return `${formatTime(dayData.open, dayData.timezone)} - ${formatTime(dayData.close, dayData.timezone)}`;
}

interface QuickInfoCardsProps {
  beerCount?: { lawrenceville: number; zelienople: number };
  nextEvent?: { name: string; date: string; location: Location } | null;
  weeklyHours?: Record<string, WeeklyHoursDay[]>;
  className?: string;
}

export function QuickInfoCards({ beerCount, nextEvent, weeklyHours, className }: QuickInfoCardsProps) {
  // Get current day in EST timezone
  const todayEST = getTodayEST();
  const currentDay = getDayOfWeekEST(todayEST).toLowerCase() as DayOfWeek;

  // Get today's hours from weeklyHours (with holiday support)
  const lawrencevilleTodayData = weeklyHours?.['lawrenceville']?.find(d => d.day === currentDay);
  const zelienopleTodayData = weeklyHours?.['zelienople']?.find(d => d.day === currentDay);

  const lawrencevilleHours = lawrencevilleTodayData ? formatHoursString(lawrencevilleTodayData) : 'Hours not available';
  const zelienopleHours = zelienopleTodayData ? formatHoursString(zelienopleTodayData) : 'Hours not available';

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
              <div className="text-lg font-medium text-foreground flex items-center justify-center gap-2">
                Lawrenceville
                {lawrencevilleTodayData?.holidayName && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1 border-amber-500 text-amber-600 dark:text-amber-400">
                    {lawrencevilleTodayData.holidayName}
                  </Badge>
                )}
              </div>
              <div className={lawrencevilleTodayData?.holidayName ? 'text-amber-600 dark:text-amber-400' : ''}>
                {lawrencevilleHours}
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-medium text-foreground flex items-center justify-center gap-2">
                Zelienople
                {zelienopleTodayData?.holidayName && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1 border-amber-500 text-amber-600 dark:text-amber-400">
                    {zelienopleTodayData.holidayName}
                  </Badge>
                )}
              </div>
              <div className={zelienopleTodayData?.holidayName ? 'text-amber-600 dark:text-amber-400' : ''}>
                {zelienopleHours}
              </div>
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
