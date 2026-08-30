/**
 * Custom hook for filtering data by location with hydration safety
 * Works with dynamically loaded locations from the database
 */

'use client';

import { useMemo } from 'react';
import { useLocationContext } from '@/components/location/location-provider';
import { useIsHydrated } from '@/lib/hooks/use-is-hydrated';
import type { LocationSlug } from '@/lib/types/location';

/**
 * Data organized by location slug
 */
export type LocationData<T> = Record<LocationSlug, T[]>;

interface UseLocationFilteredDataOptions<T> {
  /** Data organized by location slug */
  dataByLocation: LocationData<T>;
  /**
   * If true, shows data from the first available location before hydration.
   * If false, shows an empty array before hydration.
   * Default: true
   */
  showDefaultBeforeHydration?: boolean;
}

/**
 * Hook to filter data by current location with proper hydration handling
 *
 * @example
 * ```tsx
 * const filteredBeers = useLocationFilteredData({
 *   dataByLocation: {
 *     'lawrenceville': lawrencevilleBeers,
 *     'zelienople': zelienopleBeers
 *   }
 * });
 * ```
 */
export function useLocationFilteredData<T>({
  dataByLocation,
  showDefaultBeforeHydration = true
}: UseLocationFilteredDataOptions<T>): T[] {
  const { currentLocation, locations } = useLocationContext();
  // Track hydration to prevent mismatch
  const isHydrated = useIsHydrated();

  // Get the default location slug (first active location)
  const defaultLocationSlug = useMemo(() => {
    const activeLocations = locations.filter(loc => loc.active !== false);
    return activeLocations[0]?.slug || activeLocations[0]?.id || '';
  }, [locations]);

  // Filter data based on current location
  return useMemo(() => {
    if (!isHydrated) {
      return showDefaultBeforeHydration ? (dataByLocation[defaultLocationSlug] || []) : [];
    }

    // If 'all' or no location, return all data combined
    if (!currentLocation || currentLocation === 'all') {
      return Object.values(dataByLocation).flat();
    }

    // Return data for the selected location
    return dataByLocation[currentLocation] || [];
  }, [currentLocation, dataByLocation, isHydrated, showDefaultBeforeHydration, defaultLocationSlug]);
}
