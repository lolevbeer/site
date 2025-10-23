/**
 * Custom hook for filtering data by location with hydration safety
 * Extracts the common pattern used in FeaturedBeers, FeaturedCans, etc.
 */

'use client';

import { useMemo, useState, useEffect } from 'react';
import { useLocationContext } from '@/components/location/location-provider';

interface UseLocationFilteredDataOptions<T> {
  lawrencevilleData: T[];
  zelienopleData: T[];
  /**
   * If true, always shows Lawrenceville data before hydration.
   * If false, shows an empty array before hydration.
   * Default: true
   */
  defaultToLawrenceville?: boolean;
}

/**
 * Hook to filter data by current location with proper hydration handling
 *
 * @example
 * ```tsx
 * const filteredBeers = useLocationFilteredData({
 *   lawrencevilleData: lawrencevilleBeers,
 *   zelienopleData: zelienopleBeers
 * });
 * ```
 */
export function useLocationFilteredData<T>({
  lawrencevilleData,
  zelienopleData,
  defaultToLawrenceville = true
}: UseLocationFilteredDataOptions<T>): T[] {
  const { currentLocation } = useLocationContext();
  const [isHydrated, setIsHydrated] = useState(false);

  // Track hydration to prevent mismatch
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Filter data based on current location
  // Always show lawrenceville (or empty array) before hydration to prevent mismatch
  const filteredData = useMemo(() => {
    if (!isHydrated) {
      return defaultToLawrenceville ? lawrencevilleData : [];
    }

    if (currentLocation === 'lawrenceville') {
      return lawrencevilleData;
    } else if (currentLocation === 'zelienople') {
      return zelienopleData;
    }

    // Show both locations when 'all' is selected
    return [...lawrencevilleData, ...zelienopleData];
  }, [currentLocation, lawrencevilleData, zelienopleData, isHydrated, defaultToLawrenceville]);

  return filteredData;
}
