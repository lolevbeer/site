/**
 * Location configuration and utilities
 * Locations are now dynamically loaded from the database
 */

import { type PayloadLocation, type LocationSlug, type LocationInfo, toLocationInfo, type DayHours } from '@/lib/types/location';
import { getCurrentESTDateTime } from '@/lib/utils/date';

/**
 * LocalStorage key for persisting user's location preference
 */
export const LOCATION_STORAGE_KEY = 'brewery-location-preference';

/**
 * Extract hours from Payload Location for a specific day
 */
function extractDayHours(location: PayloadLocation, day: string): DayHours | null {
  const dayData = location[day as keyof PayloadLocation] as { open?: string; close?: string } | undefined;

  if (!dayData?.open || !dayData?.close) {
    return null;
  }

  // Payload stores times as ISO date strings, extract time portion
  const parseTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      const hours = date.getUTCHours().toString().padStart(2, '0');
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '00:00';
    }
  };

  return {
    open: parseTime(dayData.open),
    close: parseTime(dayData.close),
    closed: false,
  };
}

/**
 * Check if a location is currently open based on current time
 */
export function isLocationOpenNow(location: PayloadLocation, date?: Date): boolean {
  const timezone = location.timezone || 'America/New_York';
  const now = date || getCurrentESTDateTime();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = days[now.getDay()];

  const dayHours = extractDayHours(location, dayOfWeek);

  if (!dayHours || dayHours.closed) {
    return false;
  }

  const currentTime = now.getHours() * 100 + now.getMinutes();
  const openTime = parseInt(dayHours.open.replace(':', ''));
  let closeTime = parseInt(dayHours.close.replace(':', ''));

  // Handle midnight closing (00:00) - treat as 24:00 (2400)
  if (closeTime === 0) {
    closeTime = 2400;
  }

  // If closing time is less than opening time, it crosses midnight
  if (closeTime < openTime) {
    return currentTime >= openTime || currentTime <= closeTime;
  }

  return currentTime >= openTime && currentTime < closeTime;
}

/**
 * Get formatted hours string for a specific day
 */
export function getFormattedHoursForDay(location: PayloadLocation, day: string): string {
  const dayHours = extractDayHours(location, day);

  if (!dayHours || dayHours.closed) {
    return 'Closed';
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    if (minutes === 0) {
      return `${displayHours} ${ampm}`;
    }
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  return `${formatTime(dayHours.open)} - ${formatTime(dayHours.close)}`;
}

/**
 * Get next opening time for a location
 */
export function getNextOpeningTimeForLocation(location: PayloadLocation): { day: string; time: string } | null {
  const now = getCurrentESTDateTime();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  for (let i = 1; i <= 7; i++) {
    const dayIndex = (now.getDay() + i) % 7;
    const dayName = days[dayIndex];
    const dayHours = extractDayHours(location, dayName);

    if (dayHours && !dayHours.closed) {
      const dayDisplayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      return {
        day: i === 1 ? 'Tomorrow' : dayDisplayName,
        time: getFormattedHoursForDay(location, dayName)
      };
    }
  }

  return null;
}

/**
 * Get all hours for a location as an array
 */
export function getAllHoursForLocation(location: PayloadLocation): Array<{
  day: string;
  hours: string;
  isToday: boolean;
}> {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const today = new Date();
  const todayIndex = today.getDay();
  const todayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][todayIndex];

  return days.map(day => ({
    day: day.charAt(0).toUpperCase() + day.slice(1),
    hours: getFormattedHoursForDay(location, day),
    isToday: day === todayName
  }));
}

/**
 * Get the default location slug (first active location)
 */
export function getDefaultLocationSlug(locations: PayloadLocation[]): LocationSlug {
  const activeLocations = locations.filter(loc => loc.active !== false);
  return activeLocations[0]?.slug || activeLocations[0]?.id || '';
}

/**
 * Find a location by slug from an array of locations
 */
export function findLocationBySlug(locations: PayloadLocation[], slug: LocationSlug): PayloadLocation | undefined {
  return locations.find(loc => loc.slug === slug || loc.id === slug);
}

/**
 * Validate if a slug is a valid location
 */
export function isValidLocationSlug(locations: PayloadLocation[], slug: string): boolean {
  return locations.some(loc => loc.slug === slug || loc.id === slug);
}

/**
 * Get display name for a location slug
 */
export function getLocationDisplayName(locations: PayloadLocation[], slug: LocationSlug): string {
  const location = findLocationBySlug(locations, slug);
  return location?.name || slug;
}

/**
 * Convert array of Payload Locations to LocationInfo array
 */
export function toLocationInfoArray(locations: PayloadLocation[]): LocationInfo[] {
  return locations
    .filter(loc => loc.active !== false)
    .map(toLocationInfo);
}
