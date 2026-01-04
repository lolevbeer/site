/**
 * Food Schedule Component
 * Displays food truck schedule in events-style grid layout
 */

'use client';

import React from 'react';
import { FoodVendorSchedule } from '@/lib/types/food';
import type { LocationSlug } from '@/lib/types/location';
import { Card, CardContent } from '@/components/ui/card';
import { ScheduleCard } from '@/components/ui/schedule-card';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { formatTime, isToday, isFuture, isTodayOrFuture } from '@/lib/utils/formatters';
import { useLocationContext } from '@/components/location/location-provider';
import { UtensilsCrossed } from 'lucide-react';

interface FoodScheduleProps {
  schedules: FoodVendorSchedule[];
  className?: string;
  showLocationFilter?: boolean;
  onVendorClick?: (schedule: FoodVendorSchedule) => void;
  loading?: boolean;
  maxItems?: number;
}

/**
 * Food truck schedule component in events-style layout
 */
export function FoodSchedule({
  schedules,
  className,
  showLocationFilter = true,
  loading = false,
  maxItems = 12
}: FoodScheduleProps) {
  const { locations } = useLocationContext();

  const getLocationName = (slug: LocationSlug): string => {
    const location = locations.find(loc => (loc.slug || loc.id) === slug);
    return location?.name || slug;
  };

  const renderVendorCard = (schedule: FoodVendorSchedule, dateStr: string) => {
    return (
      <ScheduleCard
        key={`${schedule.vendor}-${dateStr}`}
        title={schedule.vendor}
        date={dateStr}
        time={schedule.time}
        location={showLocationFilter ? getLocationName(schedule.location) : undefined}
        site={schedule.site}
      />
    );
  };

  // Filter and sort schedules to show upcoming food trucks
  const upcomingSchedules = schedules
    .filter(schedule => isTodayOrFuture(schedule.date))
    .sort((a, b) => new Date(a.date.split('T')[0]).getTime() - new Date(b.date.split('T')[0]).getTime())
    .slice(0, maxItems);

  // Separate today's and upcoming
  const todaysFood = upcomingSchedules.filter(schedule => isToday(schedule.date));
  const upcomingFood = upcomingSchedules.filter(schedule => isFuture(schedule.date));

  return (
    <div className={cn('space-y-6', className)}>
      {/* Today's Food Section */}
      {todaysFood.length > 0 && (
        <Card className="shadow-none border-2 border-black">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-center">Today&apos;s Food</h2>
            <div className="flex flex-col gap-3">
              {todaysFood.map((schedule, index) => (
                <div key={index} className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-semibold">{schedule.vendor}</span>
                    {schedule.time && (
                      <span className="text-sm text-muted-foreground">@ {formatTime(schedule.time.split('-')[0].trim())}</span>
                    )}
                  </div>
                  {showLocationFilter && (
                    <div className="text-sm text-muted-foreground">
                      {getLocationName(schedule.location)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Food Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-6 text-center animate-pulse">
              <div className="h-6 bg-muted rounded w-3/4 mx-auto mb-4" />
              <div className="space-y-3 flex flex-col items-center">
                <div className="h-4 bg-muted rounded w-40" />
                <div className="h-4 bg-muted rounded w-24" />
                <div className="h-4 bg-muted rounded w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : upcomingFood.length > 0 ? (
        <div className={cn(
          "grid gap-4",
          upcomingFood.length < 6
            ? "grid-cols-1"
            : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        )}>
          {upcomingFood.map((schedule) => renderVendorCard(schedule, schedule.date))}
        </div>
      ) : (
        !todaysFood.length && (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UtensilsCrossed />
              </EmptyMedia>
              <EmptyTitle>No Food Trucks Scheduled</EmptyTitle>
              <EmptyDescription>
                Check back soon for upcoming food truck schedules!
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )
      )}
    </div>
  );
}

export default FoodSchedule;
