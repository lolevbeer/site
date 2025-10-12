'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { FoodVendorSchedule, FoodVendor, FoodSchedule, DayOfWeek } from '@/lib/types/food';
import { loadFoodFromCSV } from '@/lib/utils/food';
import { FoodSchedule as FoodScheduleComponent } from '@/components/food/food-schedule';
import { Button } from '@/components/ui/button';
import { useLocationContext } from '@/components/location/location-provider';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';

export default function FoodPage() {
  const { currentLocation } = useLocationContext();
  const [vendors, setVendors] = useState<FoodVendor[]>([]);
  const [schedules, setSchedules] = useState<FoodSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFood = async () => {
      try {
        const { vendors: csvVendors, schedules: csvSchedules } = await loadFoodFromCSV();
        setVendors(csvVendors);
        setSchedules(csvSchedules);
      } catch (error) {
        console.error('Error loading food data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFood();
  }, [currentLocation]);

  const vendorSchedules: FoodVendorSchedule[] = useMemo(() => {
    return schedules
      .filter(schedule => schedule.location === currentLocation)
      .map(schedule => {
        const vendor = vendors.find(v => v.id === schedule.vendorId);
        const dateStr = schedule.date.split('T')[0];
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day, 12, 0, 0);
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

        return {
          vendor: vendor?.name || 'Unknown Vendor',
          date: dateStr,
          time: `${schedule.startTime}-${schedule.endTime}`,
          site: vendor?.website,
          day: DayOfWeek[dayOfWeek.toUpperCase() as keyof typeof DayOfWeek],
          start: schedule.startTime,
          finish: schedule.endTime,
          dayNumber: date.getDay(),
          location: schedule.location,
          specialEvent: false,
          notes: schedule.notes
        } as FoodVendorSchedule;
      });
  }, [schedules, vendors, currentLocation]);


  return (
    <div className="container mx-auto px-4 py-8">
      <PageBreadcrumbs className="mb-6" />
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Food</h1>
      </div>

      <FoodScheduleComponent
        schedules={vendorSchedules}
        onVendorClick={(schedule) => schedule.site && window.open(schedule.site, '_blank')}
        showLocationFilter={false}
        maxItems={12}
        loading={loading}
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