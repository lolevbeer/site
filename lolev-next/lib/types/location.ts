/**
 * Location type definitions for the brewery website
 * Based on the two brewery locations: Lawrenceville and Zelienople
 */

/**
 * Enum for brewery locations
 */
export enum Location {
  LAWRENCEVILLE = 'lawrenceville',
  ZELIENOPLE = 'zelienople',
}

/**
 * Display names for locations
 */
export const LocationDisplayNames: Record<Location, string> = {
  [Location.LAWRENCEVILLE]: 'Lolev Beer • Lawrenceville',
  [Location.ZELIENOPLE]: 'Lolev Beer • Zelienople',
};

/**
 * Location-specific information interface
 */
export interface LocationInfo {
  /** Location identifier */
  location: Location;
  /** Display name */
  name: string;
  /** Street address */
  address: string;
  /** City */
  city: string;
  /** State */
  state: string;
  /** ZIP code */
  zipCode: string;
  /** Phone number */
  phone?: string;
  /** Email address */
  email?: string;
  /** Website URL */
  website?: string;
  /** Google Maps URL or coordinates */
  mapUrl?: string;
  /** Operating hours */
  hours: LocationHours;
  /** Location-specific features */
  features?: LocationFeature[];
  /** Parking information */
  parking?: string;
  /** Public transportation access */
  publicTransport?: string;
}

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
 * Location-specific data interface for filtering
 */
export interface LocationData<T> {
  [Location.LAWRENCEVILLE]: T;
  [Location.ZELIENOPLE]: T;
}

/**
 * Distance calculation interface
 */
export interface LocationDistance {
  /** Location identifier */
  location: Location;
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
 * Extended location info with coordinates
 */
export interface LocationInfoWithCoordinates extends LocationInfo {
  /** Geographic coordinates */
  coordinates: LocationCoordinates;
}

/**
 * Location utility types
 */
export type LocationKey = keyof typeof Location;
export type LocationValue = Location[LocationKey];

/**
 * Location selection interface for forms
 */
export interface LocationSelection {
  /** Selected location */
  location: Location;
  /** Whether this is the user's preferred location */
  isPreferred?: boolean;
  /** Last visit date */
  lastVisit?: Date;
}