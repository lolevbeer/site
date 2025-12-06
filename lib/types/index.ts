/**
 * Main type exports for the brewery website
 * Centralized export file for all TypeScript type definitions
 */

import React from 'react';

// Beer types
export type {
  Beer,
  DraftBeer,
  CannedBeer,
  ComingBeer,
  AnyBeer,
  BeerList,
  BeerFilters,
  BeerSortOptions,
  BeerPricing,
  BeerAvailability,
  BeerVariant,
  BeerType,
  BeerGlass,
  BeerSortBy,
  BeerSortOrder,
} from './beer';

export {
  GlassType,
  BeerStyle,
} from './beer';

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
  RecurringEventPattern,
  EventTime,
  EventFilters,
  EventSortOptions,
  EventList,
  EventCalendar,
  EventRSVP,
  EventNotificationPreferences,
} from './event';

export {
  EventType,
  EventFrequency,
  EventStatus,
  type EventSortBy,
  type EventSortOrder,
} from './event';

// Food types
export type {
  FoodVendor,
  FoodVendorWithMenu,
  FoodVendorSchedule,
  FoodScheduleTime,
  FoodVendorFilters,
  FoodVendorSortOptions,
  WeeklyFoodSchedule,
  DailyFoodSchedule,
  FoodVendorList,
  FoodVendorStats,
  FoodVendorNotificationPreferences,
  MenuItem,
} from './food';

export {
  FoodVendorType,
  CuisineType,
  DayOfWeek,
  DietaryOption,
  type FoodVendorSortBy,
  type FoodVendorSortOrder,
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