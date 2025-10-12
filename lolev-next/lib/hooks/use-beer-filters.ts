/**
 * Shared Beer Filtering Hook
 * Consolidates beer filtering logic for reuse across components
 */

import { useState, useMemo, useCallback } from 'react';
import type { Beer, BeerFilters } from '@/lib/types/beer';
import type { LocationFilter } from '@/lib/types/location';

export interface UseBeerFiltersOptions {
  /** Initial list of beers to filter */
  beers: Beer[];
  /** Current location filter */
  locationFilter?: LocationFilter;
  /** Initial filter values */
  initialFilters?: BeerFilters;
}

export interface UseBeerFiltersReturn {
  /** Currently filtered beers */
  filteredBeers: Beer[];
  /** Current filter state */
  filters: BeerFilters;
  /** Update filters */
  setFilters: (filters: BeerFilters | ((prev: BeerFilters) => BeerFilters)) => void;
  /** Clear all filters */
  clearFilters: () => void;
  /** Check if any filters are active */
  hasActiveFilters: boolean;
  /** Count of active filters */
  activeFilterCount: number;
  /** Total number of beers before filtering */
  totalCount: number;
  /** Number of beers after filtering */
  filteredCount: number;
}

/**
 * Hook for filtering and managing beer lists
 *
 * @example
 * ```tsx
 * const { filteredBeers, filters, setFilters, clearFilters } = useBeerFilters({
 *   beers: allBeers,
 *   locationFilter: 'lawrenceville',
 * });
 * ```
 */
export function useBeerFilters({
  beers,
  locationFilter = 'all',
  initialFilters = {},
}: UseBeerFiltersOptions): UseBeerFiltersReturn {
  const [filters, setFilters] = useState<BeerFilters>(initialFilters);

  // Filter beers by location first
  const locationFilteredBeers = useMemo(() => {
    if (locationFilter === 'all') {
      return beers;
    }

    return beers.filter(beer => {
      // Check if beer is available at current location (on tap or in cans)
      return (
        beer.availability?.[locationFilter]?.tap ||
        beer.availability?.[locationFilter]?.cansAvailable
      );
    });
  }, [beers, locationFilter]);

  // Apply all filters
  const filteredBeers = useMemo(() => {
    let result = [...locationFilteredBeers];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        beer =>
          beer.name.toLowerCase().includes(searchLower) ||
          beer.description?.toLowerCase().includes(searchLower) ||
          beer.type?.toLowerCase().includes(searchLower)
      );
    }

    // Style filter
    if (filters.style && filters.style.length > 0) {
      result = result.filter(beer =>
        filters.style!.some(style => beer.type === style)
      );
    }

    // ABV range filter
    if (filters.abvRange) {
      result = result.filter(
        beer =>
          beer.abv >= filters.abvRange!.min &&
          beer.abv <= filters.abvRange!.max
      );
    }

    // Availability filter
    if (filters.availability && filters.availability !== 'all') {
      result = result.filter(beer => {
        const availability =
          locationFilter !== 'all'
            ? beer.availability?.[locationFilter]
            : beer.availability;

        if (filters.availability === 'draft') {
          return !!availability?.tap;
        } else if (filters.availability === 'cans') {
          return !!availability?.cansAvailable;
        }
        return true;
      });
    }

    // Gluten-free filter
    if (filters.glutenFree) {
      result = result.filter(beer => beer.glutenFree === true);
    }

    return result;
  }, [locationFilteredBeers, filters, locationFilter]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.search ||
      (filters.style && filters.style.length > 0) ||
      filters.abvRange ||
      filters.availability ||
      filters.glutenFree
    );
  }, [filters]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.style && filters.style.length > 0) count++;
    if (filters.abvRange) count++;
    if (filters.availability) count++;
    if (filters.glutenFree) count++;
    return count;
  }, [filters]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  return {
    filteredBeers,
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
    totalCount: locationFilteredBeers.length,
    filteredCount: filteredBeers.length,
  };
}

/**
 * Helper hook for simple beer sorting
 */
export function useBeerSorting(beers: Beer[], sortBy: 'name' | 'abv' | 'type' = 'name') {
  return useMemo(() => {
    const sorted = [...beers];

    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'abv':
          return a.abv - b.abv;
        case 'type':
          return (a.type || '').localeCompare(b.type || '');
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return sorted;
  }, [beers, sortBy]);
}
