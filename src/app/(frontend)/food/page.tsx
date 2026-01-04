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
  vendor: string | { id: string; name: string; site?: string | null };
  date: string;
  time: string;
  start?: string;
  finish?: string;
  site?: string;
  location?: { slug?: string; id?: string } | string;
}

interface RecurringFoodSchedules {
  [locationId: string]: {
    [day: string]: {
      [week: string]: string | null;
    };
  };
}

interface RecurringFoodExclusions {
  [locationId: string]: string[];
}

interface RecurringFoodGlobal {
  schedules: RecurringFoodSchedules;
  exclusions: RecurringFoodExclusions;
}

const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const weeks = ['first', 'second', 'third', 'fourth', 'fifth'] as const;
const fullDayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Calculate upcoming occurrences of a specific week/day combo
 */
function getUpcomingDatesForSlot(dayIndex: number, weekOccurrence: number, monthsAhead: number = 3): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMonth = today.getMonth();
  const startYear = today.getFullYear();

  for (let i = 0; i < monthsAhead; i++) {
    const month = (startMonth + i) % 12;
    const year = startYear + Math.floor((startMonth + i) / 12);

    const firstOfMonth = new Date(year, month, 1);
    const firstDayOfMonth = firstOfMonth.getDay();

    let firstOccurrence = dayIndex - firstDayOfMonth + 1;
    if (firstOccurrence <= 0) firstOccurrence += 7;

    const targetDay = firstOccurrence + (weekOccurrence - 1) * 7;
    const targetDate = new Date(year, month, targetDay);

    if (targetDate.getMonth() === month && targetDate >= today) {
      dates.push(targetDate);
    }
  }

  return dates;
}

/**
 * Fetch food vendors from Payload API
 */
async function fetchFoodFromPayload(): Promise<PayloadFoodEntry[]> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

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
    return data.docs || [];
  } catch (error) {
    console.error('Error fetching food from Payload:', error);
    return [];
  }
}

/**
 * Fetch recurring food global configuration
 */
async function fetchRecurringFood(): Promise<RecurringFoodGlobal> {
  try {
    const response = await fetch('/api/globals/recurring-food');
    if (!response.ok) {
      console.error('Failed to fetch recurring food:', response.status);
      return { schedules: {}, exclusions: {} };
    }

    const data = await response.json();
    return {
      schedules: data.schedules || {},
      exclusions: data.exclusions || {},
    };
  } catch (error) {
    console.error('Error fetching recurring food:', error);
    return { schedules: {}, exclusions: {} };
  }
}

/**
 * Fetch vendor details by IDs
 */
async function fetchVendors(vendorIds: string[]): Promise<Record<string, { id: string; name: string; site?: string | null }>> {
  if (vendorIds.length === 0) return {};

  try {
    const params = new URLSearchParams();
    vendorIds.forEach(id => params.append('where[id][in]', id));
    params.append('limit', String(vendorIds.length));

    const response = await fetch(`/api/food-vendors?${params.toString()}`);
    if (!response.ok) return {};

    const data = await response.json();
    const vendorMap: Record<string, { id: string; name: string; site?: string | null }> = {};
    for (const vendor of data.docs || []) {
      vendorMap[vendor.id] = {
        id: vendor.id,
        name: vendor.name,
        site: vendor.site,
      };
    }
    return vendorMap;
  } catch {
    return {};
  }
}

/**
 * Fetch locations to get location ID -> slug mapping
 */
async function fetchLocations(): Promise<Record<string, string>> {
  try {
    const response = await fetch('/api/locations?where[active][equals]=true');
    if (!response.ok) return {};

    const data = await response.json();
    const locationMap: Record<string, string> = {};
    for (const loc of data.docs || []) {
      locationMap[loc.id] = loc.slug;
    }
    return locationMap;
  } catch {
    return {};
  }
}

/**
 * Transform Payload food entry to FoodVendorSchedule
 */
function transformPayloadEntry(entry: PayloadFoodEntry): FoodVendorSchedule {
  const locationSlug = typeof entry.location === 'object'
    ? entry.location?.slug
    : undefined;

  const vendorName = typeof entry.vendor === 'object'
    ? entry.vendor.name
    : entry.vendor;

  const vendorSite = entry.site || (typeof entry.vendor === 'object' ? entry.vendor.site : undefined);

  const dateStr = entry.date.split('T')[0];
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  const dayOfWeek = fullDayLabels[date.getDay()];

  return {
    vendor: vendorName,
    date: dateStr,
    time: entry.time || '',
    site: vendorSite ?? undefined,
    day: DayOfWeek[dayOfWeek.toUpperCase() as keyof typeof DayOfWeek],
    start: entry.start || entry.time?.split('-')[0]?.trim() || '',
    finish: entry.finish || entry.time?.split('-')[1]?.trim() || '',
    dayNumber: date.getDay(),
    location: locationSlug,
    specialEvent: false,
  } as FoodVendorSchedule;
}

export default function FoodPage() {
  const { currentLocation } = useLocationContext();
  const [schedules, setSchedules] = useState<FoodVendorSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFood = async () => {
      try {
        // Fetch all data in parallel
        const [payloadEntries, recurringFood, locationMap] = await Promise.all([
          fetchFoodFromPayload(),
          fetchRecurringFood(),
          fetchLocations(),
        ]);

        console.log('[Food Page] Recurring food data:', recurringFood);
        console.log('[Food Page] Location map:', locationMap);
        console.log('[Food Page] Individual food entries:', payloadEntries.length);

        // Transform individual food entries
        const individualSchedules = payloadEntries.map(transformPayloadEntry);

        // Create a set of dates with individual food by location
        const individualDatesByLocation: Record<string, Set<string>> = {};
        for (const entry of payloadEntries) {
          const locId = typeof entry.location === 'object' ? entry.location?.id : entry.location;
          if (locId) {
            if (!individualDatesByLocation[locId]) {
              individualDatesByLocation[locId] = new Set();
            }
            individualDatesByLocation[locId].add(entry.date.split('T')[0]);
          }
        }

        // Collect all vendor IDs from recurring schedules
        const vendorIds = new Set<string>();
        for (const locationId of Object.keys(recurringFood.schedules)) {
          const locationSchedule = recurringFood.schedules[locationId];
          for (const day of days) {
            for (const week of weeks) {
              const vendorId = locationSchedule?.[day]?.[week];
              if (vendorId) vendorIds.add(vendorId);
            }
          }
        }

        // Fetch vendor details
        console.log('[Food Page] Vendor IDs to fetch:', Array.from(vendorIds));
        const vendorMap = await fetchVendors(Array.from(vendorIds));
        console.log('[Food Page] Fetched vendors:', vendorMap);

        // Generate recurring food schedules
        const recurringSchedules: FoodVendorSchedule[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const locationId of Object.keys(recurringFood.schedules)) {
          const locationSchedule = recurringFood.schedules[locationId];
          const locationExclusions = recurringFood.exclusions[locationId] || [];
          const locationSlug = locationMap[locationId];

          if (!locationSlug) continue;

          for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
            const day = days[dayIndex];
            for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
              const week = weeks[weekIndex];
              const vendorId = locationSchedule?.[day]?.[week];

              if (vendorId && vendorMap[vendorId]) {
                const vendor = vendorMap[vendorId];
                const upcomingDates = getUpcomingDatesForSlot(dayIndex, weekIndex + 1, 3);

                for (const date of upcomingDates) {
                  const dateKey = date.toISOString().split('T')[0];

                  // Skip if excluded
                  if (locationExclusions.includes(dateKey)) continue;

                  // Skip if individual food exists for this date at this location
                  if (individualDatesByLocation[locationId]?.has(dateKey)) continue;

                  const dayOfWeek = fullDayLabels[date.getDay()];

                  recurringSchedules.push({
                    vendor: vendor.name,
                    date: dateKey,
                    time: '',
                    site: vendor.site ?? undefined,
                    day: DayOfWeek[dayOfWeek.toUpperCase() as keyof typeof DayOfWeek],
                    start: '',
                    finish: '',
                    dayNumber: date.getDay(),
                    location: locationSlug,
                    specialEvent: false,
                  } as FoodVendorSchedule);
                }
              }
            }
          }
        }

        // Combine and sort
        const combined = [...individualSchedules, ...recurringSchedules];
        combined.sort((a, b) => a.date.localeCompare(b.date));

        setSchedules(combined);
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
