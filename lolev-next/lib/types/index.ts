/**
 * Main type exports for the brewery website
 * Centralized export file for all TypeScript type definitions
 */

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
} from './beer';

export {
  GlassType,
  BeerStyle,
  type BeerSortBy,
  type BeerSortOrder,
} from './beer';

// Location types
export type {
  LocationInfo,
  LocationInfoWithCoordinates,
  LocationHours,
  DayHours,
  LocationData,
  LocationDistance,
  LocationCoordinates,
  LocationSelection,
  LocationKey,
  LocationValue,
} from './location';

export {
  Location,
  LocationDisplayNames,
  LocationFeature,
  LocationFeatureDisplayNames,
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

// Utility types for common patterns
export type ID = string | number;
export type Timestamp = string;
export type URL = string;
export type Email = string;
export type PhoneNumber = string;

// API response types
export interface APIResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
  timestamp: Timestamp;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Common filter and sort interfaces
export interface BaseFilters {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface BaseSortOptions {
  sortBy: string;
  order: 'asc' | 'desc';
}

// User preference types
export interface UserPreferences {
  preferredLocation?: Location;
  favoriteBeers?: string[];
  dietaryRestrictions?: DietaryOption[];
  eventNotifications?: EventNotificationPreferences;
  foodNotifications?: FoodVendorNotificationPreferences;
}

// Form validation types
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface FormState<T = any> {
  data: T;
  errors: ValidationError[];
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}

// Theme and UI types
export type ThemeMode = 'light' | 'dark' | 'auto';

export interface UIState {
  theme: ThemeMode;
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
  loading: boolean;
}

// Navigation types
export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  children?: NavItem[];
  external?: boolean;
}

// SEO types
export interface SEOData {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  canonical?: string;
  noIndex?: boolean;
}

// Analytics types
export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp: Timestamp;
  userId?: string;
  sessionId?: string;
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