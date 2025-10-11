/**
 * Food Schedule Component
 * Displays food truck schedule in events-style grid layout
 */

'use client';

import React from 'react';
import { FoodVendorSchedule } from '@/lib/types/food';
import { LocationDisplayNames } from '@/lib/types/location';
import { useLocationContext } from '@/components/location/location-provider';
import { Card, CardContent } from '@/components/ui/card';
import { ScheduleCard } from '@/components/ui/schedule-card';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/utils/formatters';

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
  const { currentLocation } = useLocationContext();

  const renderVendorCard = (schedule: FoodVendorSchedule, dateStr: string) => {
    return (
      <ScheduleCard
        key={`${schedule.vendor}-${dateStr}`}
        title={schedule.vendor}
        date={dateStr}
        time={schedule.time}
        location={showLocationFilter ? LocationDisplayNames[schedule.location] : undefined}
        site={schedule.site}
      />
    );
  };

  // Filter and sort schedules to show upcoming food trucks
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingSchedules = schedules
    .filter(schedule => {
      // Filter to show today and future dates
      const [year, month, day] = schedule.date.split('T')[0].split('-').map(Number);
      const scheduleDate = new Date(year, month - 1, day);
      scheduleDate.setHours(0, 0, 0, 0);

      return scheduleDate >= today;
    })
    .sort((a, b) => {
      // Sort by date
      const dateA = new Date(a.date.split('T')[0]);
      const dateB = new Date(b.date.split('T')[0]);
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, maxItems);

  // Separate today's and upcoming
  const todaysFood = upcomingSchedules.filter(schedule => {
    const [year, month, day] = schedule.date.split('T')[0].split('-').map(Number);
    const scheduleDate = new Date(year, month - 1, day);
    scheduleDate.setHours(0, 0, 0, 0);
    return scheduleDate.getTime() === today.getTime();
  });

  const upcomingFood = upcomingSchedules.filter(schedule => {
    const [year, month, day] = schedule.date.split('T')[0].split('-').map(Number);
    const scheduleDate = new Date(year, month - 1, day);
    scheduleDate.setHours(0, 0, 0, 0);
    return scheduleDate.getTime() > today.getTime();
  });

  return (
    <div className={cn('space-y-6', className)}>
      {/* Today's Food Section */}
      {todaysFood.length > 0 && (
        <Card className="shadow-none">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-center">Today's Food</h2>
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
                      {LocationDisplayNames[schedule.location]}
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
            <div key={i} className="bg-card rounded-xl border shadow-sm animate-pulse h-64" />
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
          <Card className="p-8 text-center border-0">
            <h3 className="text-lg font-semibold mb-2">No Food Trucks Scheduled</h3>
            <p className="text-muted-foreground">
              Check back soon for upcoming food truck schedules!
            </p>
          </Card>
        )
      )}
    </div>
  );
}

export default FoodSchedule;
