/**
 * Location type definitions for the brewery website
 * Locations are now dynamically loaded from the database
 */

import type { Location as BasePayloadLocation } from '@/src/payload-types';

/**
 * Extended Payload Location type
 * coordinates is now a point field: [longitude, latitude]
 */
export type PayloadLocation = BasePayloadLocation;

/**
 * Location slug type - string identifier from database
 */
export type LocationSlug = string;

/**
 * Location filter type - includes 'all' for showing all locations
 */
export type LocationFilter = LocationSlug | 'all';

/**
 * Daily hours interface
 */
export interface DayHours {
  /** Opening time (24-hour format: "HH:mm") */
  open: string;
  /** Closing time (24-hour format: "HH:mm") */
  close: string;
  /** Whether the location is closed this day */
  closed?: boolean;
}

/**
 * Weekly hours interface
 */
export interface LocationHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
  /** Special holiday hours or notes */
  notes?: string;
}

/**
 * Location features enum
 */
export enum LocationFeature {
  OUTDOOR_SEATING = 'outdoor_seating',
  PET_FRIENDLY = 'pet_friendly',
  FAMILY_FRIENDLY = 'family_friendly',
  LIVE_MUSIC = 'live_music',
  FOOD_TRUCKS = 'food_trucks',
  PRIVATE_EVENTS = 'private_events',
  TOURS = 'tours',
  MERCHANDISE = 'merchandise',
  GROWLERS = 'growlers',
  DELIVERY = 'delivery',
  TAKEOUT = 'takeout',
  WIFI = 'wifi',
  ACCESSIBILITY = 'accessibility',
}

/**
 * Location feature display names
 */
export const LocationFeatureDisplayNames: Record<LocationFeature, string> = {
  [LocationFeature.OUTDOOR_SEATING]: 'Outdoor Seating',
  [LocationFeature.PET_FRIENDLY]: 'Pet Friendly',
  [LocationFeature.FAMILY_FRIENDLY]: 'Family Friendly',
  [LocationFeature.LIVE_MUSIC]: 'Live Music',
  [LocationFeature.FOOD_TRUCKS]: 'Food Trucks',
  [LocationFeature.PRIVATE_EVENTS]: 'Private Events',
  [LocationFeature.TOURS]: 'Brewery Tours',
  [LocationFeature.MERCHANDISE]: 'Merchandise',
  [LocationFeature.GROWLERS]: 'Growler Fills',
  [LocationFeature.DELIVERY]: 'Delivery Available',
  [LocationFeature.TAKEOUT]: 'Takeout Available',
  [LocationFeature.WIFI]: 'Free WiFi',
  [LocationFeature.ACCESSIBILITY]: 'Wheelchair Accessible',
};

/**
 * Distance calculation interface
 */
export interface LocationDistance {
  /** Location slug */
  location: LocationSlug;
  /** Distance in miles */
  distance: number;
  /** Estimated travel time */
  travelTime?: string;
}

/**
 * Location coordinates interface
 */
export interface LocationCoordinates {
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
}

/**
 * Location selection interface for forms
 */
export interface LocationSelection {
  /** Selected location slug */
  location: LocationSlug;
  /** Whether this is the user's preferred location */
  isPreferred?: boolean;
  /** Last visit date */
  lastVisit?: Date;
}

/**
 * Simplified location info derived from Payload Location
 */
export interface LocationInfo {
  /** Location ID */
  id: string;
  /** Location slug */
  slug: string;
  /** Display name */
  name: string;
  /** Whether location is active */
  active: boolean;
  /** Street address */
  address?: string;
  /** City */
  city?: string;
  /** State */
  state?: string;
  /** ZIP code */
  zipCode?: string;
  /** Phone number */
  phone?: string;
  /** Email address */
  email?: string;
  /** Timezone */
  timezone?: string;
  /** Google Maps URL */
  mapUrl?: string;
}

/**
 * Convert Payload Location to simplified LocationInfo
 */
export function toLocationInfo(location: PayloadLocation): LocationInfo {
  const address = location.address?.street || undefined;
  const city = location.address?.city || undefined;
  const state = location.address?.state || undefined;
  const zipCode = location.address?.zip || undefined;

  // Use custom directions URL if provided, otherwise generate Google Maps URL
  // coordinates is a point field: [longitude, latitude]
  let mapUrl: string | undefined;
  if (location.address?.directionsUrl) {
    mapUrl = location.address.directionsUrl;
  } else if (location.coordinates && location.coordinates.length === 2) {
    const [lng, lat] = location.coordinates;
    mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  } else if (address && city && state) {
    mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${address}, ${city}, ${state} ${zipCode || ''}`
    )}`;
  }

  return {
    id: location.id,
    slug: location.slug || location.id,
    name: location.name,
    active: location.active ?? true,
    address,
    city,
    state,
    zipCode,
    phone: location.basicInfo?.phone || undefined,
    email: location.basicInfo?.email || undefined,
    timezone: location.timezone || 'America/New_York',
    mapUrl,
  };
}
