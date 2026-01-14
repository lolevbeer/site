/**
 * Custom hook for location state management
 * Provides location state with localStorage persistence, URL sync, and helper functions
 * Locations are now dynamically loaded from the database
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { type PayloadLocation, type LocationSlug, type LocationInfo, toLocationInfo } from '@/lib/types/location';
import {
  LOCATION_STORAGE_KEY,
  isLocationOpenNow,
  getFormattedHoursForDay,
  getNextOpeningTimeForLocation,
  getAllHoursForLocation,
  getDefaultLocationSlug,
  findLocationBySlug,
  isValidLocationSlug,
} from '@/lib/config/locations';

export interface UseLocationReturn {
  /** Current selected location slug */
  currentLocation: LocationSlug;
  /** Current location data from Payload */
  currentLocationData: PayloadLocation | null;
  /** Location information for current location */
  locationInfo: LocationInfo | null;
  /** All available locations */
  locations: PayloadLocation[];
  /** Set the current location and persist to localStorage */
  setLocation: (slug: LocationSlug) => void;
  /** Switch to the next location */
  cycleLocation: () => void;
  /** Whether the current location is open now */
  isOpen: boolean;
  /** Formatted hours for today */
  todaysHours: string;
  /** Next opening time if currently closed */
  nextOpening: { day: string; time: string } | null;
  /** Get location data by slug */
  getLocationBySlug: (slug: LocationSlug) => PayloadLocation | undefined;
  /** Get location info by slug */
  getLocationInfo: (slug: LocationSlug) => LocationInfo | null;
  /** Whether we're on the client (hydration check) */
  isClient: boolean;
}

/**
 * Get location preference from localStorage with fallback
 */
function getStoredLocation(locations: PayloadLocation[]): LocationSlug {
  if (typeof window === 'undefined' || locations.length === 0) {
    return getDefaultLocationSlug(locations);
  }

  try {
    const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (stored && isValidLocationSlug(locations, stored)) {
      return stored;
    }
  } catch (error) {
    console.warn('Failed to read location from localStorage:', error);
  }

  return getDefaultLocationSlug(locations);
}

/**
 * Save location preference to localStorage
 */
function saveLocationToStorage(slug: LocationSlug): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, slug);
  } catch (error) {
    console.warn('Failed to save location to localStorage:', error);
  }
}

/**
 * Custom hook for managing location state
 * Syncs location between URL params, localStorage, and React state
 *
 * @param locations - Array of locations from the database (passed from server)
 */
export function useLocation(locations: PayloadLocation[] = []): UseLocationReturn {
  const defaultSlug = useMemo(() => getDefaultLocationSlug(locations), [locations]);
  const [currentLocation, setCurrentLocationState] = useState<LocationSlug>(defaultSlug);
  const [isClient, setIsClient] = useState(false);

  // URL state for location - allows sharing URLs with location preset
  const [urlLocation, setUrlLocation] = useQueryState('loc', parseAsString);

  // Initialize from URL param first, then localStorage on client mount
  useEffect(() => {
    setIsClient(true);

    if (locations.length === 0) return;

    // Priority: URL param > localStorage > default
    if (urlLocation && isValidLocationSlug(locations, urlLocation)) {
      setCurrentLocationState(urlLocation);
      saveLocationToStorage(urlLocation);
      return;
    }

    const storedLocation = getStoredLocation(locations);
    setCurrentLocationState(storedLocation);
  }, [urlLocation, locations]);

  // Get current location data
  const currentLocationData = useMemo(
    () => findLocationBySlug(locations, currentLocation) || null,
    [locations, currentLocation]
  );

  // Get current location info
  const locationInfo = useMemo(
    () => currentLocationData ? toLocationInfo(currentLocationData) : null,
    [currentLocationData]
  );

  // Set location with persistence (localStorage only - URL sync is slow)
  const setLocation = useCallback((slug: LocationSlug) => {
    if (!isValidLocationSlug(locations, slug)) return;
    setCurrentLocationState(slug);
    saveLocationToStorage(slug);
  }, [locations]);

  // Cycle to next location
  const cycleLocation = useCallback(() => {
    const activeLocations = locations.filter(loc => loc.active !== false);
    if (activeLocations.length <= 1) return;

    const currentIndex = activeLocations.findIndex(
      loc => loc.slug === currentLocation || loc.id === currentLocation
    );
    const nextIndex = (currentIndex + 1) % activeLocations.length;
    const nextSlug = activeLocations[nextIndex].slug || activeLocations[nextIndex].id;
    setLocation(nextSlug);
  }, [locations, currentLocation, setLocation]);

  // Check if current location is open
  const isOpen = useMemo(
    () => currentLocationData ? isLocationOpenNow(currentLocationData) : false,
    [currentLocationData]
  );

  // Get today's hours
  const todaysHours = useMemo(() => {
    if (!currentLocationData) return 'Hours unavailable';
    const today = new Date();
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()];
    return getFormattedHoursForDay(currentLocationData, dayOfWeek);
  }, [currentLocationData]);

  // Get next opening time if closed
  const nextOpening = useMemo(
    () => currentLocationData && !isOpen ? getNextOpeningTimeForLocation(currentLocationData) : null,
    [currentLocationData, isOpen]
  );

  // Helper to get location data by slug
  const getLocationBySlug = useCallback(
    (slug: LocationSlug) => findLocationBySlug(locations, slug),
    [locations]
  );

  // Helper to get location info by slug
  const getLocationInfo = useCallback((slug: LocationSlug): LocationInfo | null => {
    const loc = findLocationBySlug(locations, slug);
    return loc ? toLocationInfo(loc) : null;
  }, [locations]);

  return {
    currentLocation,
    currentLocationData,
    locationInfo,
    locations,
    setLocation,
    cycleLocation,
    isOpen,
    todaysHours,
    nextOpening,
    getLocationBySlug,
    getLocationInfo,
    isClient
  };
}

/**
 * Hook specifically for getting hours information
 */
export function useLocationHours(locations: PayloadLocation[], locationSlug?: LocationSlug) {
  const { currentLocation, getLocationBySlug } = useLocation(locations);
  const targetSlug = locationSlug || currentLocation;
  const targetLocation = getLocationBySlug(targetSlug);

  const getHoursForDay = useCallback((day: string) => {
    if (!targetLocation) return 'Hours unavailable';
    return getFormattedHoursForDay(targetLocation, day);
  }, [targetLocation]);

  const getAllHours = useCallback(() => {
    if (!targetLocation) return [];
    return getAllHoursForLocation(targetLocation);
  }, [targetLocation]);

  return {
    getHoursForDay,
    getAllHours,
    isOpen: targetLocation ? isLocationOpenNow(targetLocation) : false,
    nextOpening: targetLocation ? getNextOpeningTimeForLocation(targetLocation) : null
  };
}
