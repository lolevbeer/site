'use client';

import React, { useMemo } from 'react';
import { FoodVendorSchedule } from '@/lib/types/food';
import { Button } from '@/components/ui/button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { UtensilsCrossed } from 'lucide-react';
import { useLocationContext } from '@/components/location/location-provider';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { TimelineList } from '@/components/ui/timeline-list';
import { TimelineItem } from '@/components/ui/timeline-item';
import { isTodayOrFuture } from '@/lib/utils/formatters';

interface FoodPageClientProps {
  initialSchedules: FoodVendorSchedule[];
}

export function FoodPageClient({ initialSchedules }: FoodPageClientProps) {
  const { currentLocation, locations } = useLocationContext();

  // Get location name from slug
  const getLocationName = (slug: string): string => {
    const location = locations.find(loc => (loc.slug || loc.id) === slug);
    return location?.name || slug;
  };

  // Filter schedules by current location and sort by date
  const filteredSchedules = useMemo(() => {
    return initialSchedules
      .filter(schedule => schedule.location === currentLocation)
      .filter(schedule => isTodayOrFuture(schedule.date))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(schedule => ({
        ...schedule,
        id: `${schedule.vendor}-${schedule.date}`
      }));
  }, [initialSchedules, currentLocation]);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageBreadcrumbs className="mb-6" />
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Food</h1>
      </div>

      <div className="max-w-2xl mx-auto">
        <TimelineList
          items={filteredSchedules}
          renderItem={(schedule) => (
            <TimelineItem
              title={schedule.vendor}
              time={schedule.time || schedule.start}
              endTime={schedule.finish}
              location={getLocationName(schedule.location)}
              site={schedule.site}
              imageUrl={schedule.logoUrl}
            />
          )}
          emptyState={
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UtensilsCrossed className="h-6 w-6" />
                </EmptyMedia>
                <EmptyTitle>No Food Trucks Scheduled</EmptyTitle>
                <EmptyDescription>
                  Check back soon for upcoming food truck schedules!
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          }
        />
      </div>

      <div className="text-center space-y-3 pt-12 mt-12">
        <h2 className="text-lg font-semibold">Food Truck Partner?</h2>
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
      </div>
    </div>
  );
}
