/**
 * Custom hooks for data fetching
 * Provides React hooks that integrate with the data service layer
 */

'use client';

import { useState, useEffect } from 'react';
import { Beer } from '@/lib/types/beer';
import { BreweryEvent } from '@/lib/types/event';
import { FoodVendor } from '@/lib/types/food';
import { Location } from '@/lib/types/location';
import {
  BeerService,
  EventService,
  FoodVendorService,
  DataService
} from '@/lib/services/data-service';

/**
 * Generic data hook with loading and error states
 */
function useDataFetch<T>(
  fetcher: () => Promise<T>,
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetcher();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: () => fetcher() };
}

/**
 * Hook for fetching beer data
 */
export function useBeers(location?: Location) {
  return useDataFetch<Beer[]>(
    () => location ? BeerService.getByLocation(location) : BeerService.getAll(),
    [location]
  );
}

/**
 * Hook for fetching a single beer
 */
export function useBeer(variant: string) {
  return useDataFetch<Beer | null>(
    () => BeerService.getByVariant(variant),
    [variant]
  );
}

/**
 * Hook for fetching available beers
 */
export function useAvailableBeers() {
  return useDataFetch<Beer[]>(() => BeerService.getAvailable(), []);
}

/**
 * Hook for fetching event data
 */
export function useEvents(location?: Location) {
  return useDataFetch<BreweryEvent[]>(
    () => location ? EventService.getByLocation(location) : EventService.getAll(),
    [location]
  );
}

/**
 * Hook for fetching upcoming events
 */
export function useUpcomingEvents(daysAhead = 30) {
  return useDataFetch<BreweryEvent[]>(
    () => EventService.getUpcoming(daysAhead),
    [daysAhead]
  );
}

/**
 * Hook for fetching today's events
 */
export function useTodayEvents() {
  return useDataFetch<BreweryEvent[]>(() => EventService.getToday(), []);
}

/**
 * Hook for fetching food vendor data
 */
export function useFoodVendors(location?: Location) {
  return useDataFetch<FoodVendor[]>(
    () => location ? FoodVendorService.getByLocation(location) : FoodVendorService.getAll(),
    [location]
  );
}

/**
 * Hook for fetching active food vendors
 */
export function useActiveFoodVendors() {
  return useDataFetch<FoodVendor[]>(() => FoodVendorService.getActive(), []);
}

/**
 * Hook for fetching a single food vendor
 */
export function useFoodVendor(id: string) {
  return useDataFetch<FoodVendor | null>(
    () => FoodVendorService.getById(id),
    [id]
  );
}

/**
 * Hook for fetching all data for a location
 */
export function useLocationData(location: Location) {
  return useDataFetch(
    () => DataService.getLocationData(location),
    [location]
  );
}

/**
 * Hook for fetching today's overview
 */
export function useTodayOverview() {
  return useDataFetch(() => DataService.getTodayOverview(), []);
}

/**
 * Hook for prefetching all data
 * Useful for initial page load
 */
export function usePrefetchData() {
  useEffect(() => {
    DataService.prefetchAll();
  }, []);
}