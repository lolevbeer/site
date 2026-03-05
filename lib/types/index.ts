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

export { GlassType } from './beer';
export type { BeerStyle } from './beer';

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

