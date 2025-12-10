/**
 * Main type exports for the brewery website
 */

import React from 'react';

// Beer types
export type {
  Beer,
  DraftBeer,
  CannedBeer,
  BeerFilters,
  BeerSortOptions,
  BeerPricing,
  BeerAvailability,
  BeerSortBy,
  BeerSortOrder,
} from './beer';

export { GlassType, BeerStyle } from './beer';

// Location types
export type {
  LocationSlug,
  LocationInfo,
  LocationHours,
  DayHours,
  LocationDistance,
  LocationCoordinates,
  LocationSelection,
  LocationFilter,
  PayloadLocation,
} from './location';

export {
  LocationFeature,
  LocationFeatureDisplayNames,
  toLocationInfo,
} from './location';

// Event types
export type {
  BaseEvent,
  BreweryEvent,
  EventFilters,
  EventSortOptions,
} from './event';

export {
  EventType,
  EventStatus,
  type EventSortBy,
  type EventSortOrder,
} from './event';

// Food types
export type { FoodVendorSchedule } from './food';

export {
  FoodVendorType,
  CuisineType,
  DayOfWeek,
  DietaryOption,
} from './food';

// Theme and UI types
export type ThemeMode = 'light' | 'dark' | 'auto';

// Navigation types
export interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
  external?: boolean;
}

// Configuration types
export interface AppConfig {
  apiUrl: string;
  environment: 'development' | 'staging' | 'production';
  features: Record<string, boolean>;
  analytics?: {
    gtag?: string;
    segment?: string;
  };
  social?: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
  };
}
