/**
 * Dynamic location-based data structures
 * Replaces hardcoded lawrenceville/zelienople pattern
 */

import type { PayloadLocation } from '@/lib/types/location'
import type { Beer } from './beer'

/**
 * Location data map - keyed by location slug
 */
export type LocationDataMap<T> = Map<string, T>

/**
 * Location-based beer data structure
 */
export interface LocationBeerData {
  location: PayloadLocation
  beers: Beer[]
}

/**
 * Location-based cans data structure
 */
export interface LocationCansData {
  location: PayloadLocation
  cans: any[] // TODO: Type this properly with Can interface
}

/**
 * Location-based events data structure
 */
export interface LocationEventsData {
  location: PayloadLocation
  events: any[] // TODO: Type this properly with Event interface
}

/**
 * Location-based food data structure
 */
export interface LocationFoodData {
  location: PayloadLocation
  food: any[] // TODO: Type this properly with Food interface
}

/**
 * Aggregated location data for homepage
 */
export interface LocationAggregatedData {
  locations: PayloadLocation[]
  beersByLocation: LocationDataMap<Beer[]>
  cansByLocation: LocationDataMap<any[]>
  eventsByLocation: LocationDataMap<any[]>
  foodByLocation: LocationDataMap<any[]>
}

/**
 * Helper to convert location array to map keyed by slug
 */
export function createLocationMap<T>(
  locations: PayloadLocation[],
  dataGetter: (location: PayloadLocation) => T
): LocationDataMap<T> {
  const map = new Map<string, T>()
  locations.forEach(location => {
    if (location.slug) {
      map.set(location.slug, dataGetter(location))
    }
  })
  return map
}
