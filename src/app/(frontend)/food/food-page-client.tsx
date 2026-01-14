'use client';

import React, { useMemo } from 'react';
import { FoodVendorSchedule } from '@/lib/types/food';
import { FoodSchedule as FoodScheduleComponent } from '@/components/food/food-schedule';
import { Button } from '@/components/ui/button';
import { useLocationContext } from '@/components/location/location-provider';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';

interface FoodPageClientProps {
  initialSchedules: FoodVendorSchedule[];
}

export function FoodPageClient({ initialSchedules }: FoodPageClientProps) {
  const { currentLocation } = useLocationContext();

  // Filter schedules by current location
  const filteredSchedules = useMemo(() => {
    return initialSchedules.filter(schedule => schedule.location === currentLocation);
  }, [initialSchedules, currentLocation]);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageBreadcrumbs className="mb-6" />
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Food</h1>
      </div>

      <FoodScheduleComponent
        schedules={filteredSchedules}
        onVendorClick={(schedule) => schedule.site && window.open(schedule.site, '_blank')}
        showLocationFilter={false}
        maxItems={12}
        loading={false}
      />

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
