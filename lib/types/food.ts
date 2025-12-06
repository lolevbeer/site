/**
 * Food vendor and schedule type definitions
 * Based on CSV data schema from _data/*-food.csv files
 */

import type { LocationSlug } from './location';

/**
 * Food vendor types/categories
 */
export enum FoodVendorType {
  FOOD_TRUCK = 'food_truck',
  CATERING = 'catering',
  POP_UP = 'pop_up',
  RESTAURANT_PARTNER = 'restaurant_partner',
  INTERNAL = 'internal',
}

/**
 * Cuisine types
 */
export enum CuisineType {
  AMERICAN = 'american',
  MEXICAN = 'mexican',
  ITALIAN = 'italian',
  ASIAN = 'asian',
  PIZZA = 'pizza',
  BBQ = 'bbq',
  DELI = 'deli',
  SANDWICHES = 'sandwiches',
  SEAFOOD = 'seafood',
  VEGETARIAN = 'vegetarian',
  VEGAN = 'vegan',
  FUSION = 'fusion',
  CARIBBEAN = 'caribbean',
  MEDITERRANEAN = 'mediterranean',
  INDIAN = 'indian',
  THAI = 'thai',
  CHINESE = 'chinese',
  JAPANESE = 'japanese',
  KOREAN = 'korean',
  GREEK = 'greek',
  GERMAN = 'german',
  FRENCH = 'french',
  SOUTHERN = 'southern',
  COMFORT_FOOD = 'comfort_food',
  HEALTHY = 'healthy',
  DESSERT = 'dessert',
  SNACKS = 'snacks',
}

/**
 * Days of the week enum
 */
export enum DayOfWeek {
  SUNDAY = 'Sunday',
  MONDAY = 'Monday',
  TUESDAY = 'Tuesday',
  WEDNESDAY = 'Wednesday',
  THURSDAY = 'Thursday',
  FRIDAY = 'Friday',
  SATURDAY = 'Saturday',
}

/**
 * Base detailed food vendor interface (legacy)
 */
export interface FoodVendorDetailed {
  /** Vendor name */
  name: string;
  /** Vendor type */
  type: FoodVendorType;
  /** Cuisine types offered */
  cuisineTypes: CuisineType[];
  /** Vendor description */
  description?: string;
  /** Vendor website or social media */
  website?: string;
  /** Instagram handle */
  instagram?: string;
  /** Facebook page */
  facebook?: string;
  /** Phone number */
  phone?: string;
  /** Email address */
  email?: string;
  /** Vendor logo or image */
  image?: string;
  /** Whether vendor is currently active */
  active: boolean;
  /** Popular menu items */
  popularItems?: string[];
  /** Price range (1-4: $, $$, $$$, $$$$) */
  priceRange?: number;
  /** Dietary options available */
  dietaryOptions?: DietaryOption[];
}

/**
 * Dietary options enum
 */
export enum DietaryOption {
  VEGETARIAN = 'vegetarian',
  VEGAN = 'vegan',
  GLUTEN_FREE = 'gluten_free',
  DAIRY_FREE = 'dairy_free',
  NUT_FREE = 'nut_free',
  KETO = 'keto',
  LOW_CARB = 'low_carb',
  HALAL = 'halal',
  KOSHER = 'kosher',
}

/**
 * Food vendor schedule interface (based on CSV schema)
 */
export interface FoodVendorSchedule {
  /** Vendor name */
  vendor: string;
  /** Date of service (YYYY-MM-DD format) */
  date: string;
  /** Service time range (e.g., "4-9pm") */
  time: string;
  /** Vendor website or social media link */
  site?: string;
  /** Day of the week */
  day: DayOfWeek;
  /** Start time (24-hour format) */
  start: string;
  /** End time (24-hour format) */
  finish: string;
  /** Week number of the year */
  week?: string;
  /** Day number (1-7, where 1 is Sunday) */
  dayNumber: number;
  /** Location where vendor will be */
  location: LocationSlug;
  /** Special notes or announcements */
  notes?: string;
  /** Whether this is a special event */
  specialEvent?: boolean;
  /** Estimated capacity/servings */
  capacity?: number;
}

/**
 * Food schedule entry for a vendor at a specific time and location
 */
export interface FoodSchedule {
  /** Unique ID */
  id: string;
  /** Vendor ID reference */
  vendorId: string;
  /** Date of service */
  date: string;
  /** Start time */
  startTime: string;
  /** End time */
  endTime: string;
  /** Location */
  location: LocationSlug;
  /** Optional notes */
  notes?: string;
}

/**
 * Food vendor with simplified data from CSV
 */
export interface FoodVendor {
  /** Unique ID */
  id: string;
  /** Vendor name */
  name: string;
  /** Cuisine type */
  cuisine?: string;
  /** Website or social media */
  website?: string;
  /** Description */
  description?: string;
  /** Popular items */
  popular?: string[];
  /** Active status */
  isActive?: boolean;
}

/**
 * Food schedule time interface for parsing
 */
export interface FoodScheduleTime {
  /** Start hour (24-hour format) */
  startHour: number;
  /** Start minute */
  startMinute: number;
  /** End hour (24-hour format) */
  endHour: number;
  /** End minute */
  endMinute: number;
  /** Original time string */
  originalTimeString: string;
}

/**
 * Food vendor search and filter interface
 */
export interface FoodVendorFilters {
  /** Filter by location */
  location?: LocationSlug;
  /** Filter by cuisine type */
  cuisineTypes?: CuisineType[];
  /** Filter by date range */
  dateRange?: {
    start: string;
    end: string;
  };
  /** Filter by day of week */
  daysOfWeek?: DayOfWeek[];
  /** Filter by vendor type */
  vendorType?: FoodVendorType[];
  /** Filter by dietary options */
  dietaryOptions?: DietaryOption[];
  /** Filter by price range */
  priceRange?: {
    min: number;
    max: number;
  };
  /** Search by vendor name or cuisine */
  search?: string;
  /** Show only active vendors */
  activeOnly?: boolean;
}

/**
 * Food vendor sorting options
 */
export type FoodVendorSortBy = 'name' | 'date' | 'priceRange';
export type FoodVendorSortOrder = 'asc' | 'desc';

export interface FoodVendorSortOptions {
  sortBy: FoodVendorSortBy;
  order: FoodVendorSortOrder;
}

/**
 * Weekly food schedule interface
 */
export interface WeeklyFoodSchedule {
  /** Week starting date */
  weekStart: string;
  /** Week ending date */
  weekEnd: string;
  /** Week number */
  weekNumber: number;
  /** Schedule by location */
  schedule: Record<LocationSlug, DailyFoodSchedule[]>;
  /** Total vendor appearances for the week */
  totalVendors: number;
}

/**
 * Daily food schedule interface
 */
export interface DailyFoodSchedule {
  /** Date */
  date: string;
  /** Day of week */
  day: DayOfWeek;
  /** Vendors scheduled for this day */
  vendors: FoodVendorSchedule[];
  /** Whether this is a special event day */
  specialEvent?: boolean;
}

/**
 * Food vendor list response interface
 */
export interface FoodVendorList {
  /** List of vendor schedules */
  schedules: FoodVendorSchedule[];
  /** List of unique vendors */
  vendors: FoodVendor[];
  /** Total count */
  total: number;
  /** Applied filters */
  filters?: FoodVendorFilters;
  /** Last updated timestamp */
  lastUpdated?: string;
}

/**
 * Food vendor statistics interface
 */
export interface FoodVendorStats {
  /** Total number of vendors */
  totalVendors: number;
  /** Most popular cuisine types */
  popularCuisines: Array<{
    cuisine: CuisineType;
    count: number;
  }>;
  /** Vendors by location */
  vendorsByLocation: Record<LocationSlug, number>;
  /** Average appearances per vendor */
  averageAppearances: number;
  /** Most frequent vendors */
  topVendors: Array<{
    vendor: string;
    appearances: number;
  }>;
}

/**
 * Food vendor notification preferences
 */
export interface FoodVendorNotificationPreferences {
  /** Notify about new vendor schedules */
  newSchedules: boolean;
  /** Notify about schedule changes */
  scheduleUpdates: boolean;
  /** Preferred cuisine types */
  cuisineTypes: CuisineType[];
  /** Preferred locations */
  locations: LocationSlug[];
  /** Preferred vendors */
  favoriteVendors: string[];
  /** How far in advance to notify (in hours) */
  advanceNotice: number;
}

/**
 * Menu item interface (optional extension)
 */
export interface MenuItem {
  /** Item name */
  name: string;
  /** Item description */
  description?: string;
  /** Price */
  price: number;
  /** Category */
  category: string;
  /** Dietary options */
  dietaryOptions: DietaryOption[];
  /** Spice level (1-5) */
  spiceLevel?: number;
  /** Whether item is popular */
  popular?: boolean;
  /** Image URL */
  image?: string;
}

/**
 * Extended food vendor with menu
 */
export interface FoodVendorWithMenu extends FoodVendor {
  /** Menu items */
  menu?: MenuItem[];
  /** Menu last updated */
  menuLastUpdated?: string;
}