/**
 * Location configuration and data for brewery locations
 * Contains all location-specific information including hours, features, and contact details
 */

import {
  Location,
  LocationInfo,
  LocationFeature,
  LocationDisplayNames,
  LocationData
} from '@/lib/types/location';
import { getCurrentESTDateTime } from '@/lib/utils/date';

/**
 * Default location when no preference is set
 */
export const DEFAULT_LOCATION = Location.LAWRENCEVILLE;

/**
 * LocalStorage key for persisting user's location preference
 */
export const LOCATION_STORAGE_KEY = 'brewery-location-preference';

/**
 * Complete location information for Lawrenceville brewery
 */
const lawrencevilleInfo: LocationInfo = {
  location: Location.LAWRENCEVILLE,
  name: LocationDisplayNames[Location.LAWRENCEVILLE],
  address: '5247 Butler Street',
  city: 'Pittsburgh',
  state: 'PA',
  zipCode: '15201',
  phone: '(412) 336-8965',
  email: 'info@lolev.beer',
  mapUrl: 'https://www.google.com/maps/place/Lolev+Beer/@40.4816854,-79.9539243,115m/data=!3m1!1e3!4m6!3m5!1s0x8834f326312e16b9:0x333ef823676989b4!8m2!3d40.4816217!4d-79.9538576!16s%2Fg%2F11snh_567n?entry=ttu&g_ep=EgoyMDI1MTEwNC4xIKXMDSoASAFQAw%3D%3D',
  hours: {
    monday: { open: '16:00', close: '22:00' },
    tuesday: { open: '16:00', close: '22:00' },
    wednesday: { open: '16:00', close: '22:00' },
    thursday: { open: '16:00', close: '22:00' },
    friday: { open: '12:00', close: '00:00' },
    saturday: { open: '12:00', close: '00:00' },
    sunday: { open: '12:00', close: '21:00' }
  },
  features: [
    LocationFeature.OUTDOOR_SEATING,
    LocationFeature.PET_FRIENDLY,
    LocationFeature.FAMILY_FRIENDLY,
    LocationFeature.LIVE_MUSIC,
    LocationFeature.FOOD_TRUCKS,
    LocationFeature.PRIVATE_EVENTS,
    LocationFeature.TOURS,
    LocationFeature.MERCHANDISE,
    LocationFeature.GROWLERS,
    LocationFeature.TAKEOUT,
    LocationFeature.WIFI,
    LocationFeature.ACCESSIBILITY
  ],
  parking: 'Street parking available.',
  publicTransport: 'Served by Port Authority buses. Lawrenceville bus stops within 2 blocks.'
};

/**
 * Complete location information for Zelienople brewery
 */
const zelienopleInfo: LocationInfo = {
  location: Location.ZELIENOPLE,
  name: LocationDisplayNames[Location.ZELIENOPLE],
  address: '111 South Main Street',
  city: 'Zelienople',
  state: 'PA',
  zipCode: '16063',
  website: 'https://brewery.com/zelienople',
  mapUrl: 'https://www.google.com/maps/place/Lolev+Zelienople/@40.7951959,-80.1380706,147m/data=!3m1!1e3!4m6!3m5!1s0x88347fadb692e2ed:0xfe6860215987e498!8m2!3d40.7952085!4d-80.1377104!16s%2Fg%2F11y91skx6n?entry=ttu&g_ep=EgoyMDI1MTEwNC4xIKXMDSoASAFQAw%3D%3D',
  hours: {
    monday: { open: '17:00', close: '22:00' },
    tuesday: { open: '17:00', close: '22:00' },
    wednesday: { open: '17:00', close: '22:00' },
    thursday: { open: '17:00', close: '22:00' },
    friday: { open: '12:00', close: '00:00' },
    saturday: { open: '12:00', close: '00:00' },
    sunday: { open: '12:00', close: '21:00' }
  },
  features: [
    LocationFeature.OUTDOOR_SEATING,
    LocationFeature.PET_FRIENDLY,
    LocationFeature.FAMILY_FRIENDLY,
    LocationFeature.FOOD_TRUCKS,
    LocationFeature.PRIVATE_EVENTS,
    LocationFeature.TOURS,
    LocationFeature.MERCHANDISE,
    LocationFeature.GROWLERS,
    LocationFeature.DELIVERY,
    LocationFeature.TAKEOUT,
    LocationFeature.WIFI,
    LocationFeature.ACCESSIBILITY
  ],
  parking: 'Free parking lot adjacent to building. Additional street parking on Main Street.',
  publicTransport: 'Limited public transportation. Private vehicle recommended.'
};

/**
 * Centralized location data mapping
 */
export const LOCATIONS_DATA: LocationData<LocationInfo> = {
  [Location.LAWRENCEVILLE]: lawrencevilleInfo,
  [Location.ZELIENOPLE]: zelienopleInfo,
};

/**
 * Array of all available locations for iteration
 */
export const ALL_LOCATIONS = Object.values(Location);

/**
 * Array of location info objects for easy access
 */
export const ALL_LOCATION_INFO = ALL_LOCATIONS.map(location => LOCATIONS_DATA[location]);

/**
 * Get location information by location enum
 */
export function getLocationInfo(location: Location): LocationInfo {
  return LOCATIONS_DATA[location];
}

/**
 * Get location by string value (useful for URL params, form inputs, etc.)
 */
export function getLocationByValue(value: string): Location | null {
  const location = Object.values(Location).find(loc => loc === value);
  return location || null;
}

/**
 * Check if a location is currently open based on current time in EST
 */
export function isLocationOpen(location: Location, date?: Date): boolean {
  const locationInfo = getLocationInfo(location);
  // Use EST timezone for determining current time
  const now = date || getCurrentESTDateTime();
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()] as keyof typeof locationInfo.hours;

  const dayHours = locationInfo.hours[dayOfWeek];

  // Type guard: notes is a string, not DayHours
  if (typeof dayHours === 'string' || !dayHours) {
    return false;
  }

  if (dayHours.closed) {
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
    // e.g., open at 16:00, close at 02:00 next day
    return currentTime >= openTime || currentTime <= closeTime;
  }

  return currentTime >= openTime && currentTime < closeTime;
}

/**
 * Get formatted hours string for a specific day
 */
export function getFormattedHours(location: Location, day: keyof LocationInfo['hours']): string {
  const locationInfo = getLocationInfo(location);
  const dayHours = locationInfo.hours[day];

  // Type guard: check if this is the notes field first
  if (day === 'notes') {
    return (dayHours as string) || '';
  }

  // Type guard: ensure dayHours is DayHours, not string
  if (typeof dayHours === 'string' || !dayHours) {
    return 'Closed';
  }

  if (dayHours.closed) return 'Closed';

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  return `${formatTime(dayHours.open)} - ${formatTime(dayHours.close)}`;
}

/**
 * Get next opening time for a location using EST timezone
 */
export function getNextOpeningTime(location: Location): { day: string; time: string } | null {
  const locationInfo = getLocationInfo(location);
  const now = getCurrentESTDateTime();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  for (let i = 1; i <= 7; i++) {
    const dayIndex = (now.getDay() + i) % 7;
    const dayName = days[dayIndex] as keyof typeof locationInfo.hours;
    const dayHours = locationInfo.hours[dayName];

    // Type guard: ensure dayHours is DayHours, not string
    if (typeof dayHours === 'string' || !dayHours) {
      continue;
    }

    if (!dayHours.closed) {
      const dayDisplayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      return {
        day: i === 1 ? 'Tomorrow' : dayDisplayName,
        time: getFormattedHours(location, dayName)
      };
    }
  }

  return null;
}

/**
 * Location-specific feature availability
 */
export const LOCATION_FEATURES: LocationData<LocationFeature[]> = {
  [Location.LAWRENCEVILLE]: lawrencevilleInfo.features || [],
  [Location.ZELIENOPLE]: zelienopleInfo.features || [],
};

/**
 * Check if a location has a specific feature
 */
export function locationHasFeature(location: Location, feature: LocationFeature): boolean {
  return LOCATION_FEATURES[location].includes(feature);
}

/**
 * Get all features available across both locations
 */
export function getAllAvailableFeatures(): LocationFeature[] {
  const allFeatures = new Set<LocationFeature>();
  Object.values(LOCATION_FEATURES).forEach(features => {
    features.forEach((feature: LocationFeature) => allFeatures.add(feature));
  });
  return Array.from(allFeatures);
}

/**
 * Location coordinates for mapping (if needed in the future)
 */
export const LOCATION_COORDINATES: LocationData<{ lat: number; lng: number }> = {
  [Location.LAWRENCEVILLE]: { lat: 40.4649, lng: -79.9603 },
  [Location.ZELIENOPLE]: { lat: 40.7937, lng: -80.1384 },
};