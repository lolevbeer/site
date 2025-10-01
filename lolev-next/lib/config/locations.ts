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
  mapUrl: 'https://share.google/6DHKHO4c2nZOMfAho',
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
  mapUrl: 'https://share.google/joEL4NcPAo96qgWnQ',
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
 * Check if a location is currently open based on current time
 */
export function isLocationOpen(location: Location, date?: Date): boolean {
  const locationInfo = getLocationInfo(location);
  const now = date || new Date();
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()] as keyof typeof locationInfo.hours;

  const dayHours = locationInfo.hours[dayOfWeek];

  if (dayHours.closed) {
    return false;
  }

  const currentTime = now.getHours() * 100 + now.getMinutes();
  const openTime = parseInt(dayHours.open.replace(':', ''));
  const closeTime = parseInt(dayHours.close.replace(':', ''));

  return currentTime >= openTime && currentTime <= closeTime;
}

/**
 * Get formatted hours string for a specific day
 */
export function getFormattedHours(location: Location, day: keyof LocationInfo['hours']): string {
  const locationInfo = getLocationInfo(location);
  const dayHours = locationInfo.hours[day];

  if (day === 'notes') return dayHours as string;
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
 * Get next opening time for a location
 */
export function getNextOpeningTime(location: Location): { day: string; time: string } | null {
  const locationInfo = getLocationInfo(location);
  const now = new Date();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  for (let i = 1; i <= 7; i++) {
    const dayIndex = (now.getDay() + i) % 7;
    const dayName = days[dayIndex] as keyof typeof locationInfo.hours;
    const dayHours = locationInfo.hours[dayName];

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
    features.forEach(feature => allFeatures.add(feature));
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