/**
 * Location Context Provider
 * Provides global location state management throughout the application
 * Locations are dynamically loaded from the database
 */

'use client';

import React, { createContext, useContext, ReactNode, useMemo, Suspense } from 'react';
import { type PayloadLocation, type LocationSlug, type LocationInfo } from '@/lib/types/location';
import { useLocation, useLocationHours } from '@/lib/hooks/use-location';
import {
  isLocationOpenNow,
  getAllHoursForLocation,
  getNextOpeningTimeForLocation,
} from '@/lib/config/locations';

interface LocationContextValue {
  // Core location state
  currentLocation: LocationSlug;
  currentLocationData: PayloadLocation | null;
  locationInfo: LocationInfo | null;
  locations: PayloadLocation[];
  setLocation: (slug: LocationSlug) => void;
  cycleLocation: () => void;

  // Status information
  isOpen: boolean;
  todaysHours: string;
  nextOpening: { day: string; time: string } | null;

  // Helper functions
  getLocationBySlug: (slug: LocationSlug) => PayloadLocation | undefined;
  getLocationInfo: (slug: LocationSlug) => LocationInfo | null;
  isClient: boolean;

  // Hours management
  hours: {
    getHoursForDay: (day: string) => string;
    getAllHours: () => Array<{
      day: string;
      hours: string;
      isToday: boolean;
    }>;
    isOpen: boolean;
    nextOpening: { day: string; time: string } | null;
  };
}

const LocationContext = createContext<LocationContextValue | null>(null);

interface LocationProviderProps {
  children: ReactNode;
  /** Locations fetched from the database (passed from server) */
  locations: PayloadLocation[];
}

/**
 * Inner provider component that uses hooks requiring useSearchParams
 * This is wrapped in Suspense to support static generation
 */
function LocationProviderInner({ children, locations }: LocationProviderProps) {
  const locationState = useLocation(locations);
  const hoursState = useLocationHours(locations);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue: LocationContextValue = useMemo(() => ({
    // Core state from useLocation
    currentLocation: locationState.currentLocation,
    currentLocationData: locationState.currentLocationData,
    locationInfo: locationState.locationInfo,
    locations: locationState.locations,
    setLocation: locationState.setLocation,
    cycleLocation: locationState.cycleLocation,
    isOpen: locationState.isOpen,
    todaysHours: locationState.todaysHours,
    nextOpening: locationState.nextOpening,
    getLocationBySlug: locationState.getLocationBySlug,
    getLocationInfo: locationState.getLocationInfo,
    isClient: locationState.isClient,

    // Hours state
    hours: hoursState,
  }), [locationState, hoursState]);

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
}

/**
 * Location Context Provider Component
 * Wraps the application to provide location state globally
 * Wrapped in Suspense for Next.js 15 compatibility with useSearchParams
 */
export function LocationProvider({ children, locations }: LocationProviderProps) {
  return (
    <Suspense fallback={null}>
      <LocationProviderInner locations={locations}>{children}</LocationProviderInner>
    </Suspense>
  );
}

/**
 * Hook to use the location context
 * Throws error if used outside of LocationProvider
 */
export function useLocationContext(): LocationContextValue {
  const context = useContext(LocationContext);

  if (!context) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }

  return context;
}

/**
 * Higher-order component to provide location context
 */
export function withLocationProvider<P extends { locations: PayloadLocation[] }>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <LocationProvider locations={props.locations}>
      <Component {...props} />
    </LocationProvider>
  );

  WrappedComponent.displayName = `withLocationProvider(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * Component to conditionally render content based on location
 */
interface LocationConditionalProps {
  locationSlug?: LocationSlug | LocationSlug[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function LocationConditional({
  locationSlug,
  fallback = null,
  children
}: LocationConditionalProps) {
  const { currentLocation } = useLocationContext();

  if (!locationSlug) {
    return <>{children}</>;
  }

  const targetLocations = Array.isArray(locationSlug) ? locationSlug : [locationSlug];
  const shouldRender = targetLocations.includes(currentLocation);

  return shouldRender ? <>{children}</> : <>{fallback}</>;
}

/**
 * Component to render location-specific content
 */
interface LocationSpecificProps {
  content: Record<LocationSlug, ReactNode>;
  fallback?: ReactNode;
}

export function LocationSpecific({
  content,
  fallback = null
}: LocationSpecificProps) {
  const { currentLocation } = useLocationContext();

  return <>{content[currentLocation] || fallback}</>;
}

/**
 * Hook for location-aware routing and navigation
 */
export function useLocationRouting() {
  const { currentLocation, setLocation } = useLocationContext();

  const getLocationPath = (path: string, slug?: LocationSlug) => {
    const targetLocation = slug || currentLocation;
    return `/${targetLocation}${path.startsWith('/') ? path : `/${path}`}`;
  };

  const navigateWithLocation = (path: string, slug?: LocationSlug) => {
    const locationPath = getLocationPath(path, slug);
    return locationPath;
  };

  return {
    currentLocation,
    setLocation,
    getLocationPath,
    navigateWithLocation
  };
}
