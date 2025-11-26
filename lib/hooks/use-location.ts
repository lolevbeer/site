/**
 * Custom hook for location state management
 * Provides location state with localStorage persistence, URL sync, and helper functions
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { Location, LocationInfo } from '@/lib/types/location';
import {
  DEFAULT_LOCATION,
  LOCATION_STORAGE_KEY,
  getLocationInfo,
  getLocationByValue,
  isLocationOpen,
  getFormattedHours,
  getNextOpeningTime,
  locationHasFeature
} from '@/lib/config/locations';

interface UseLocationReturn {
  /** Current selected location */
  currentLocation: Location;
  /** Location information for current location */
  locationInfo: LocationInfo;
  /** Set the current location and persist to localStorage */
  setLocation: (location: Location) => void;
  /** Switch to the other location */
  toggleLocation: () => void;
  /** Whether the current location is open now */
  isOpen: boolean;
  /** Formatted hours for today */
  todaysHours: string;
  /** Next opening time if currently closed */
  nextOpening: { day: string; time: string } | null;
  /** Check if current location has a specific feature */
  hasFeature: (feature: string) => boolean;
  /** Get location info by location enum */
  getLocation: (location: Location) => LocationInfo;
  /** Whether we're on the client (hydration check) */
  isClient: boolean;
}

/**
 * Get location preference from localStorage with fallback
 */
function getStoredLocation(): Location {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCATION;
  }

  try {
    const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (stored) {
      const location = getLocationByValue(stored);
      if (location) {
        return location;
      }
    }
  } catch (error) {
    console.warn('Failed to read location from localStorage:', error);
  }

  return DEFAULT_LOCATION;
}

/**
 * Save location preference to localStorage
 */
function saveLocationToStorage(location: Location): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, location);
  } catch (error) {
    console.warn('Failed to save location to localStorage:', error);
  }
}

/**
 * Custom hook for managing location state
 * Syncs location between URL params, localStorage, and React state
 */
export function useLocation(): UseLocationReturn {
  const [currentLocation, setCurrentLocationState] = useState<Location>(DEFAULT_LOCATION);
  const [isClient, setIsClient] = useState(false);

  // URL state for location - allows sharing URLs with location preset
  const [urlLocation, setUrlLocation] = useQueryState('loc', parseAsString);

  // Initialize from URL param first, then localStorage on client mount
  useEffect(() => {
    setIsClient(true);

    // Priority: URL param > localStorage > default
    if (urlLocation) {
      const locationFromUrl = getLocationByValue(urlLocation);
      if (locationFromUrl) {
        setCurrentLocationState(locationFromUrl);
        saveLocationToStorage(locationFromUrl);
        return;
      }
    }

    const storedLocation = getStoredLocation();
    setCurrentLocationState(storedLocation);
  }, [urlLocation]);

  // Get current location info
  const locationInfo = getLocationInfo(currentLocation);

  // Set location with persistence (localStorage + URL)
  const setLocation = useCallback((location: Location) => {
    setCurrentLocationState(location);
    saveLocationToStorage(location);
    // Update URL param for shareable links
    setUrlLocation(location);
  }, [setUrlLocation]);

  // Toggle between locations
  const toggleLocation = useCallback(() => {
    const newLocation = currentLocation === Location.LAWRENCEVILLE
      ? Location.ZELIENOPLE
      : Location.LAWRENCEVILLE;
    setLocation(newLocation);
  }, [currentLocation, setLocation]);

  // Check if current location is open
  const isOpen = isLocationOpen(currentLocation);

  // Get today's hours
  const today = new Date();
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()] as keyof LocationInfo['hours'];
  const todaysHours = getFormattedHours(currentLocation, dayOfWeek);

  // Get next opening time if closed
  const nextOpening = isOpen ? null : getNextOpeningTime(currentLocation);

  // Helper to check if current location has feature
  const hasFeature = useCallback((feature: string) => {
    return locationHasFeature(currentLocation, feature as any);
  }, [currentLocation]);

  // Helper to get any location info
  const getLocation = useCallback((location: Location) => {
    return getLocationInfo(location);
  }, []);

  return {
    currentLocation,
    locationInfo,
    setLocation,
    toggleLocation,
    isOpen,
    todaysHours,
    nextOpening,
    hasFeature,
    getLocation,
    isClient
  };
}

/**
 * Hook specifically for getting hours information
 */
export function useLocationHours(location?: Location) {
  const { currentLocation } = useLocation();
  const targetLocation = location || currentLocation;

  const getHoursForDay = useCallback((day: keyof LocationInfo['hours']) => {
    return getFormattedHours(targetLocation, day);
  }, [targetLocation]);

  const getAllHours = useCallback(() => {
    const days: (keyof LocationInfo['hours'])[] = [
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
    ];

    return days.map(day => ({
      day: day.charAt(0).toUpperCase() + day.slice(1),
      hours: getHoursForDay(day),
      isToday: day === ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()]
    }));
  }, [getHoursForDay]);

  return {
    getHoursForDay,
    getAllHours,
    isOpen: isLocationOpen(targetLocation),
    nextOpening: getNextOpeningTime(targetLocation)
  };
}

/**
 * Hook for location comparison
 */
export function useLocationComparison() {
  const { currentLocation } = useLocation();

  const compareFeatures = useCallback(() => {
    const lawrencevilleInfo = getLocationInfo(Location.LAWRENCEVILLE);
    const zelienopleInfo = getLocationInfo(Location.ZELIENOPLE);

    const lawrencevilleFeatures = new Set(lawrencevilleInfo.features || []);
    const zelienopleFeatures = new Set(zelienopleInfo.features || []);

    const commonFeatures = [...lawrencevilleFeatures].filter(feature =>
      zelienopleFeatures.has(feature)
    );

    const lawrencevilleOnly = [...lawrencevilleFeatures].filter(feature =>
      !zelienopleFeatures.has(feature)
    );

    const zelienopleOnly = [...zelienopleFeatures].filter(feature =>
      !lawrencevilleFeatures.has(feature)
    );

    return {
      common: commonFeatures,
      lawrencevilleOnly,
      zelienopleOnly
    };
  }, []);

  const getOtherLocation = useCallback(() => {
    return currentLocation === Location.LAWRENCEVILLE
      ? Location.ZELIENOPLE
      : Location.LAWRENCEVILLE;
  }, [currentLocation]);

  return {
    compareFeatures,
    getOtherLocation,
    currentLocation
  };
}