/**
 * Food truck utility functions for loading and parsing food schedules from CSV
 */

import { Location } from '@/lib/types/location';
import { FoodVendor, FoodSchedule } from '@/lib/types/food';
import { fetchCSV } from './csv';
import { getTodayEST, isTodayEST } from './date';

export interface FoodCSVRow {
  vendor: string;
  date: string;
  time: string;
  site: string;
  day: string;
  start: string;
  finish: string;
  week: string;
  dayNumber: string;
}

/**
 * Generate unique vendor ID from name
 */
function generateVendorId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
}

/**
 * Parse time string to standard format
 */
function parseTimeString(timeStr: string): { start: string; end: string } {
  if (!timeStr || timeStr === '') {
    return { start: '5:00 PM', end: '9:00 PM' }; // Default times
  }

  // Handle ranges like "4-9pm" or "5pm-9pm"
  const match = timeStr.match(/(\d+(?::\d+)?)(am|pm)?[-–](\d+(?::\d+)?)(am|pm)/i);
  if (match) {
    let startTime = match[1];
    const startPeriod = match[2] || match[4]; // Use end period if start doesn't have one
    let endTime = match[3];
    const endPeriod = match[4];

    // Add :00 if missing
    if (!startTime.includes(':')) startTime += ':00';
    if (!endTime.includes(':')) endTime += ':00';

    // Format with AM/PM
    const formatTime = (time: string, period: string) => {
      return `${time} ${period.toUpperCase()}`;
    };

    return {
      start: formatTime(startTime, startPeriod),
      end: formatTime(endTime, endPeriod)
    };
  }

  // Fallback for other formats
  return { start: '5:00 PM', end: '9:00 PM' };
}

/**
 * Get cuisine type from vendor name (basic inference)
 */
function inferCuisineType(vendor: string): string {
  const v = vendor.toLowerCase();
  if (v.includes('taco') || v.includes('mexican') || v.includes('oaxaca') || v.includes('rincon')) return 'Mexican';
  if (v.includes('pizza')) return 'Italian';
  if (v.includes('deli')) return 'American Deli';
  if (v.includes('brick oven') || v.includes('aviva')) return 'Pizza';
  if (v.includes('sando')) return 'Sandwiches';
  if (v.includes('haitian') || v.includes('sak pase')) return 'Haitian';
  if (v.includes('reyes')) return 'Latin American';
  return 'Street Food';
}

/**
 * Parse food CSV row into vendor and schedule
 */
function parseFoodRow(row: FoodCSVRow, location: Location): { vendor: FoodVendor | null; schedule: FoodSchedule | null } {
  // Skip empty rows
  if (!row.vendor) {
    return { vendor: null, schedule: null };
  }

  const vendorId = generateVendorId(row.vendor);

  // Handle time parsing - use start/finish if available, otherwise parse time string
  let start: string, end: string;
  if (row.start && row.finish) {
    // Use explicit start/finish times
    start = row.start;
    end = row.finish;
  } else if (row.time) {
    // Parse time string
    const parsed = parseTimeString(row.time);
    start = parsed.start;
    end = parsed.end;
  } else {
    // Default times when no time is specified
    start = '5:00 PM';
    end = '9:00 PM';
  }

  // Create vendor
  const vendor: FoodVendor = {
    id: vendorId,
    name: row.vendor,
    cuisine: inferCuisineType(row.vendor),
    website: row.site || undefined,
    description: `Enjoy delicious ${inferCuisineType(row.vendor)} cuisine from ${row.vendor}.`,
    popular: [],
    isActive: true
  };

  // Create schedule if date is provided
  let schedule: FoodSchedule | null = null;
  if (row.date) {
    const scheduleDate = new Date(row.date);
    if (!isNaN(scheduleDate.getTime())) {
      schedule = {
        id: `${vendorId}-${row.date}`,
        vendorId,
        date: scheduleDate.toISOString(),
        startTime: start,
        endTime: end,
        location,
        notes: undefined
      };
    }
  }

  return { vendor, schedule };
}

/**
 * Load food vendors and schedules from CSV files
 */
export async function loadFoodFromCSV(): Promise<{
  vendors: FoodVendor[];
  schedules: FoodSchedule[];
}> {
  try {
    const [lawrencevilleFood, zelienopleFood] = await Promise.all([
      fetchCSV<FoodCSVRow>('lawrenceville-food.csv'),
      fetchCSV<FoodCSVRow>('zelienople-food.csv')
    ]);

    const vendorsMap = new Map<string, FoodVendor>();
    const schedules: FoodSchedule[] = [];

    // Process Lawrenceville food data
    lawrencevilleFood.forEach(row => {
      const { vendor, schedule } = parseFoodRow(row, Location.LAWRENCEVILLE);
      if (vendor) {
        vendorsMap.set(vendor.id, vendor);
      }
      if (schedule) {
        schedules.push(schedule);
      }
    });

    // Process Zelienople food data
    zelienopleFood.forEach(row => {
      const { vendor, schedule } = parseFoodRow(row, Location.ZELIENOPLE);
      if (vendor) {
        // Merge if vendor already exists
        const existing = vendorsMap.get(vendor.id);
        if (!existing) {
          vendorsMap.set(vendor.id, vendor);
        }
      }
      if (schedule) {
        schedules.push(schedule);
      }
    });

    // Filter to recent and upcoming schedules (within 60 days past and all future)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const sixtyDaysAgoStr = `${sixtyDaysAgo.getFullYear()}-${String(sixtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sixtyDaysAgo.getDate()).padStart(2, '0')}`;

    const filteredSchedules = schedules.filter(schedule => {
      const scheduleDateStr = schedule.date.split('T')[0];
      return scheduleDateStr >= sixtyDaysAgoStr;
    }).sort((a, b) => a.date.localeCompare(b.date));

    return {
      vendors: Array.from(vendorsMap.values()),
      schedules: filteredSchedules
    };
  } catch (error) {
    console.error('Error loading food data from CSV:', error);
    return { vendors: [], schedules: [] };
  }
}

/**
 * Get today's food trucks for a location
 */
export async function getTodaysFoodTrucks(location: Location): Promise<FoodSchedule[]> {
  const { schedules } = await loadFoodFromCSV();

  return schedules.filter(schedule => {
    return schedule.location === location && isTodayEST(schedule.date);
  });
}

/**
 * Get upcoming food trucks for a location (next 7 days)
 */
export async function getUpcomingFoodTrucks(location: Location): Promise<FoodSchedule[]> {
  const { schedules } = await loadFoodFromCSV();
  const todayEST = getTodayEST();
  const nextWeek = new Date(todayEST);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  return schedules.filter(schedule => {
    const scheduleDateStr = schedule.date.split('T')[0];
    return schedule.location === location &&
           scheduleDateStr >= todayEST &&
           scheduleDateStr <= nextWeekStr;
  });
}