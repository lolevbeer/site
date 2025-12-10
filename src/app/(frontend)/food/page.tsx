'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { FoodVendorSchedule, DayOfWeek } from '@/lib/types/food';
import { FoodSchedule as FoodScheduleComponent } from '@/components/food/food-schedule';
import { Button } from '@/components/ui/button';
import { useLocationContext } from '@/components/location/location-provider';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import { generateFoodEventJsonLd } from '@/lib/utils/json-ld';

interface PayloadFoodEntry {
  id: string;
  vendor: string;
  date: string;
  time: string;
  start?: string;
  finish?: string;
  site?: string;
  location?: { slug?: string } | string;
}

/**
 * Fetch food vendors from Payload API
 */
async function fetchFoodFromPayload(): Promise<FoodVendorSchedule[]> {
  try {
    // Get today's date at midnight for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    // Fetch all food entries from today onwards using Payload REST API
    const params = new URLSearchParams({
      'where[date][greater_than_equal]': todayStr,
      sort: 'date',
      limit: '100',
      depth: '1',
    });

    const response = await fetch(`/api/food?${params.toString()}`);
    if (!response.ok) {
      console.error('Failed to fetch food:', response.status);
      return [];
    }

    const data = await response.json();
    const entries: PayloadFoodEntry[] = data.docs || [];

    // Transform Payload food entries to FoodVendorSchedule format
    return entries.map((entry) => {
      const locationSlug = typeof entry.location === 'object'
        ? entry.location?.slug
        : undefined;

      const dateStr = entry.date.split('T')[0];
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day, 12, 0, 0);
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

      return {
        vendor: entry.vendor,
        date: dateStr,
        time: entry.time || '',
        site: entry.site,
        day: DayOfWeek[dayOfWeek.toUpperCase() as keyof typeof DayOfWeek],
        start: entry.start || entry.time?.split('-')[0]?.trim() || '',
        finish: entry.finish || entry.time?.split('-')[1]?.trim() || '',
        dayNumber: date.getDay(),
        location: locationSlug,
        specialEvent: false,
      } as FoodVendorSchedule;
    });
  } catch (error) {
    console.error('Error fetching food from Payload:', error);
    return [];
  }
}

export default function FoodPage() {
  const { currentLocation } = useLocationContext();
  const [schedules, setSchedules] = useState<FoodVendorSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFood = async () => {
      try {
        const payloadSchedules = await fetchFoodFromPayload();
        setSchedules(payloadSchedules);
      } catch (error) {
        console.error('Error loading food data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFood();
  }, []);

  // Filter schedules by current location
  const filteredSchedules = useMemo(() => {
    return schedules.filter(schedule => schedule.location === currentLocation);
  }, [schedules, currentLocation]);

  // Generate JSON-LD for all food vendor schedules
  const foodEventsJsonLd = useMemo(() => {
    if (filteredSchedules.length === 0) return null;

    // Filter out invalid schedules
    const validSchedules = filteredSchedules.filter(
      schedule => schedule && schedule.vendor && schedule.date && schedule.location
    );

    if (validSchedules.length === 0) return null;

    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: validSchedules.map((schedule, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: generateFoodEventJsonLd(schedule)
      }))
    };
  }, [filteredSchedules]);


  return (
    <>
      {/* Add JSON-LD structured data for SEO */}
      {!loading && foodEventsJsonLd && (
        <JsonLd data={foodEventsJsonLd} />
      )}

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
    </>
  );
}