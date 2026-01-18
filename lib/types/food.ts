/**
 * Food vendor and schedule type definitions
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
 * Food vendor schedule interface
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
  /** Vendor logo URL */
  logoUrl?: string;
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
  /** Location display name */
  locationName?: string;
  /** Special notes or announcements */
  notes?: string;
  /** Whether this is a special event */
  specialEvent?: boolean;
  /** Estimated capacity/servings */
  capacity?: number;
}
