/**
 * Hours utility functions for loading and formatting location hours from CSV
 */

import { Location } from '@/lib/types/location';
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
 * Load hours data from CSV files
 */
export async function loadHoursFromCSV(): Promise<Record<Location, LocationHours>> {
  const [lawrencevilleHours, zelienopleHours] = await Promise.all([
    fetchCSV<HoursCSVRow>('lawrenceville-hours.csv'),
    fetchCSV<HoursCSVRow>('zelienople-hours.csv')
  ]);

  const dayMapping: Record<string, keyof LocationHours> = {
    Mon: 'monday', Tue: 'tuesday', Wed: 'wednesday', Thu: 'thursday',
    Fri: 'friday', Sat: 'saturday', Sun: 'sunday'
  };

  const closedDay = { open: '00:00', close: '00:00', closed: true };

  const parseLocationHours = (data: HoursCSVRow[]): LocationHours => {
    const hours = Object.fromEntries(
      Object.values(dayMapping).map(day => [day, closedDay])
    ) as unknown as LocationHours;

    data.forEach(row => {
      const dayKey = dayMapping[row.name];
      if (dayKey) hours[dayKey] = parseHoursString(row.hours);
    });

    return hours;
  };

  return {
    [Location.LAWRENCEVILLE]: parseLocationHours(lawrencevilleHours),
    [Location.ZELIENOPLE]: parseLocationHours(zelienopleHours)
  };
}

/**
 * Get hours for a specific location
 */
export async function getLocationHours(location: Location): Promise<LocationHours | null> {
  const allHours = await loadHoursFromCSV();
  return allHours[location] || null;
}