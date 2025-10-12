/**
 * Beer Filter Constants
 * Shared constants for beer filtering across the application
 */

/**
 * ABV Level categories with ranges and labels
 */
export const ABV_LEVELS = {
  LOW: {
    min: 0,
    max: 5,
    label: 'Low (0-5%)',
    value: 'low',
  },
  MEDIUM: {
    min: 5,
    max: 7,
    label: 'Medium (5-7%)',
    value: 'medium',
  },
  HIGH: {
    min: 7,
    max: 15,
    label: 'High (7%+)',
    value: 'high',
  },
} as const;

/**
 * Default ABV range for filters
 */
export const DEFAULT_ABV_RANGE = {
  min: 0,
  max: 15,
} as const;

/**
 * Cache duration for beer data (5 minutes in milliseconds)
 */
export const BEER_DATA_CACHE_TTL = 5 * 60 * 1000;

/**
 * Type for ABV level values
 */
export type ABVLevel = typeof ABV_LEVELS[keyof typeof ABV_LEVELS]['value'];

/**
 * Helper to get ABV range from level
 */
export function getABVRangeFromLevel(level: ABVLevel): { min: number; max: number } {
  const levelEntry = Object.values(ABV_LEVELS).find(l => l.value === level);
  if (!levelEntry) {
    return DEFAULT_ABV_RANGE;
  }
  return { min: levelEntry.min, max: levelEntry.max };
}

/**
 * Helper to check if ABV falls within a level
 */
export function isABVInLevel(abv: number, level: ABVLevel): boolean {
  const range = getABVRangeFromLevel(level);
  return abv >= range.min && abv < range.max;
}
