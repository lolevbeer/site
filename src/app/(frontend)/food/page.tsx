import { Metadata } from 'next';
import { getPayload } from 'payload';
import config from '@/src/payload.config';
import { JsonLd } from '@/components/seo/json-ld';
import { FoodPageClient } from './food-page-client';
import { FoodVendorSchedule, DayOfWeek } from '@/lib/types/food';
import { getMediaUrl } from '@/lib/utils/media-utils';

export const metadata: Metadata = {
  title: 'Food | Lolev Beer',
  description: 'Food trucks and vendors at Lolev Beer in Lawrenceville and Zelienople',
};

// Revalidate every hour
export const revalidate = 3600;

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

interface PayloadFoodEntry {
  id: string;
  vendor: string | { id: string; name: string; site?: string | null; logo?: string | { url?: string } | null };
  date: string;
  time: string;
  start?: string;
  finish?: string;
  site?: string;
  location?: { slug?: string; id?: string; name?: string } | string;
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

/**
 * Fetch all food data server-side
 */
async function getFoodData(): Promise<FoodVendorSchedule[]> {
  const payload = await getPayload({ config });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch individual food entries
  const foodResult = await payload.find({
    collection: 'food',
    where: {
      date: {
        greater_than_equal: today.toISOString(),
      },
    },
    sort: 'date',
    limit: 100,
    depth: 2,
  });

  // Fetch recurring food global
  const recurringFood = await payload.findGlobal({
    slug: 'recurring-food',
  });

  // Fetch locations
  const locationsResult = await payload.find({
    collection: 'locations',
    where: {
      active: { equals: true },
    },
    limit: 100,
  });

  const locationMap: Record<string, { slug: string; name: string }> = {};
  for (const loc of locationsResult.docs) {
    locationMap[loc.id] = { slug: loc.slug || '', name: loc.name };
  }

  // Transform individual food entries
  const individualSchedules: FoodVendorSchedule[] = [];
  const individualDatesByLocation: Record<string, Set<string>> = {};

  for (const entry of foodResult.docs as unknown as PayloadFoodEntry[]) {
    const locId = typeof entry.location === 'object' ? entry.location?.id : entry.location;
    const locationSlug = typeof entry.location === 'object' ? entry.location?.slug : undefined;
    const locationName = typeof entry.location === 'object' ? entry.location?.name : undefined;

    const vendorName = typeof entry.vendor === 'object' ? entry.vendor.name : entry.vendor;
    const vendorSite = entry.site || (typeof entry.vendor === 'object' ? entry.vendor.site : undefined);
    const vendorLogo = typeof entry.vendor === 'object'
      ? getMediaUrl(entry.vendor.logo)
      : undefined;

    const dateStr = entry.date.split('T')[0];
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    const dayOfWeek = fullDayLabels[date.getDay()];

    if (locId) {
      if (!individualDatesByLocation[locId]) {
        individualDatesByLocation[locId] = new Set();
      }
      individualDatesByLocation[locId].add(dateStr);
    }

    individualSchedules.push({
      vendor: vendorName,
      date: dateStr,
      time: entry.time || '',
      site: vendorSite ?? undefined,
      logoUrl: vendorLogo ?? undefined,
      day: DayOfWeek[dayOfWeek.toUpperCase() as keyof typeof DayOfWeek],
      start: entry.start || entry.time?.split('-')[0]?.trim() || '',
      finish: entry.finish || entry.time?.split('-')[1]?.trim() || '',
      dayNumber: date.getDay(),
      location: locationSlug,
      locationName: locationName,
      specialEvent: false,
    } as FoodVendorSchedule);
  }

  // Collect vendor IDs from recurring schedules
  const vendorIds = new Set<string>();
  const schedules = (recurringFood?.schedules || {}) as RecurringFoodSchedules;
  const exclusions = (recurringFood?.exclusions || {}) as RecurringFoodExclusions;

  for (const locationId of Object.keys(schedules)) {
    const locationSchedule = schedules[locationId];
    for (const day of days) {
      for (const week of weeks) {
        const vendorId = locationSchedule?.[day]?.[week];
        if (vendorId) vendorIds.add(vendorId);
      }
    }
  }

  // Fetch vendor details
  const vendorMap: Record<string, { id: string; name: string; site?: string | null; logoUrl?: string }> = {};
  if (vendorIds.size > 0) {
    const vendorsResult = await payload.find({
      collection: 'food-vendors',
      where: {
        id: { in: Array.from(vendorIds) },
      },
      limit: vendorIds.size,
      depth: 2,
    });

    for (const vendor of vendorsResult.docs) {
      vendorMap[vendor.id] = {
        id: vendor.id,
        name: vendor.name,
        site: vendor.site,
        logoUrl: getMediaUrl(vendor.logo),
      };
    }
  }

  // Generate recurring food schedules
  const recurringSchedules: FoodVendorSchedule[] = [];

  for (const locationId of Object.keys(schedules)) {
    const locationSchedule = schedules[locationId];
    const locationExclusions = exclusions[locationId] || [];
    const locationInfo = locationMap[locationId];

    if (!locationInfo) continue;

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
              logoUrl: vendor.logoUrl,
              day: DayOfWeek[dayOfWeek.toUpperCase() as keyof typeof DayOfWeek],
              start: '',
              finish: '',
              dayNumber: date.getDay(),
              location: locationInfo.slug,
              locationName: locationInfo.name,
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

  return combined;
}

/**
 * Generate JSON-LD for food events
 */
function generateFoodEventsJsonLd(schedules: FoodVendorSchedule[]) {
  const validSchedules = schedules.filter(
    schedule => schedule && schedule.vendor && schedule.date && schedule.location
  );

  if (validSchedules.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: validSchedules.map((schedule, index) => {
      const locationName = schedule.locationName ||
        (schedule.location === 'lawrenceville' ? 'Lolev Beer - Lawrenceville' : 'Lolev Beer - Zelienople');

      const locationAddress = schedule.location === 'lawrenceville'
        ? '115 43rd St, Pittsburgh, PA 15201'
        : '148 S Main St, Zelienople, PA 16063';

      return {
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'FoodEvent',
          name: `${schedule.vendor} at ${locationName}`,
          startDate: schedule.date,
          location: {
            '@type': 'Place',
            name: locationName,
            address: {
              '@type': 'PostalAddress',
              streetAddress: locationAddress,
            },
          },
          organizer: {
            '@type': 'Organization',
            name: 'Lolev Beer',
            url: 'https://lolev.beer',
          },
          ...(schedule.site && { url: schedule.site }),
        },
      };
    }),
  };
}

export default async function FoodPage() {
  const schedules = await getFoodData();
  const jsonLd = generateFoodEventsJsonLd(schedules);

  return (
    <>
      {/* JSON-LD structured data for all locations */}
      {jsonLd && <JsonLd data={jsonLd} />}

      <FoodPageClient initialSchedules={schedules} />
    </>
  );
}
