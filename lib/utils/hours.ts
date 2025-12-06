/**
 * Hours utility functions for loading and formatting location hours from CSV
 */

import type { LocationSlug } from '@/lib/types/location';
import { fetchCSV } from './csv';

export interface HoursCSVRow {
  name: string;
  hours: string;
  'day-code': string;
}

export interface LocationHours {
  monday: { open: string; close: string; closed?: boolean };
  tuesday: { open: string; close: string; closed?: boolean };
  wednesday: { open: string; close: string; closed?: boolean };
  thursday: { open: string; close: string; closed?: boolean };
  friday: { open: string; close: string; closed?: boolean };
  saturday: { open: string; close: string; closed?: boolean };
  sunday: { open: string; close: string; closed?: boolean };
}

/**
 * Convert time string to 24h format
 */
function convertTo24h(timeStr: string): string {
  const normalized = timeStr.toLowerCase();
  if (normalized === 'noon') return '12:00';
  if (normalized === '12am' || normalized === 'midnight') return '00:00';

  const match = normalized.match(/(\d{1,2})(am|pm)/);
  if (!match) return '00:00';

  const hours = parseInt(match[1]);
  const isPM = match[2] === 'pm';
  const hour24 = hours === 12 ? (isPM ? 12 : 0) : (isPM ? hours + 12 : hours);

  return `${hour24.toString().padStart(2, '0')}:00`;
}

/**
 * Parse hours string (e.g., "4pm - 10pm") to 24h format
 */
function parseHoursString(hoursStr: string): { open: string; close: string; closed: boolean } {
  if (!hoursStr || hoursStr.toLowerCase() === 'closed') {
    return { open: '00:00', close: '00:00', closed: true };
  }

  const [openStr, closeStr] = hoursStr.split(' - ').map(s => s.trim());
  return { open: convertTo24h(openStr), close: convertTo24h(closeStr), closed: false };
}

/**
 * Load hours data from CSV files for a specific location
 */
export async function loadHoursFromCSV(locationSlug: LocationSlug): Promise<LocationHours> {
  const hoursData = await fetchCSV<HoursCSVRow>(`${locationSlug}-hours.csv`);

  const dayMapping: Record<string, keyof LocationHours> = {
    Mon: 'monday', Tue: 'tuesday', Wed: 'wednesday', Thu: 'thursday',
    Fri: 'friday', Sat: 'saturday', Sun: 'sunday'
  };

  const closedDay = { open: '00:00', close: '00:00', closed: true };

  const hours = Object.fromEntries(
    Object.values(dayMapping).map(day => [day, closedDay])
  ) as unknown as LocationHours;

  hoursData.forEach(row => {
    const dayKey = dayMapping[row.name];
    if (dayKey) hours[dayKey] = parseHoursString(row.hours);
  });

  return hours;
}

/**
 * Load hours data from CSV files for multiple locations
 */
export async function loadAllHoursFromCSV(locationSlugs: LocationSlug[]): Promise<Record<LocationSlug, LocationHours>> {
  const results = await Promise.all(
    locationSlugs.map(async slug => {
      try {
        const hours = await loadHoursFromCSV(slug);
        return [slug, hours] as [LocationSlug, LocationHours];
      } catch {
        // Return default closed hours if file doesn't exist
        const closedDay = { open: '00:00', close: '00:00', closed: true };
        return [slug, {
          monday: closedDay,
          tuesday: closedDay,
          wednesday: closedDay,
          thursday: closedDay,
          friday: closedDay,
          saturday: closedDay,
          sunday: closedDay
        }] as [LocationSlug, LocationHours];
      }
    })
  );

  return Object.fromEntries(results);
}

/**
 * Get hours for a specific location
 */
export async function getLocationHours(locationSlug: LocationSlug): Promise<LocationHours | null> {
  try {
    return await loadHoursFromCSV(locationSlug);
  } catch {
    return null;
  }
}
