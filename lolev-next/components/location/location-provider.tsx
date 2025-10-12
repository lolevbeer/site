/**
 * Location Context Provider
 * Provides global location state management throughout the application
 */

'use client';

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { Location, LocationInfo, LocationFeature } from '@/lib/types/location';
import { useLocation, useLocationHours, useLocationComparison } from '@/lib/hooks/use-location';

interface LocationContextValue {
  // Core location state
  currentLocation: Location;
  locationInfo: LocationInfo;
  setLocation: (location: Location) => void;
  toggleLocation: () => void;

  // Status information
  isOpen: boolean;
  todaysHours: string;
  nextOpening: { day: string; time: string } | null;

  // Helper functions
  hasFeature: (feature: LocationFeature) => boolean;
  getLocation: (location: Location) => LocationInfo;
  isClient: boolean;

  // Hours management
  hours: {
    getHoursForDay: (day: keyof LocationInfo['hours']) => string;
    getAllHours: () => Array<{
      day: string;
      hours: string;
      isToday: boolean;
    }>;
    isOpen: boolean;
    nextOpening: { day: string; time: string } | null;
  };

  // Location comparison
  comparison: {
    compareFeatures: () => {
      common: LocationFeature[];
      lawrencevilleOnly: LocationFeature[];
      zelienopleOnly: LocationFeature[];
    };
    getOtherLocation: () => Location;
    currentLocation: Location;
  };
}

const LocationContext = createContext<LocationContextValue | null>(null);

interface LocationProviderProps {
  children: ReactNode;
}

/**
 * Location Context Provider Component
 * Wraps the application to provide location state globally
 */
export function LocationProvider({ children }: LocationProviderProps) {
  const locationState = useLocation();
  const hoursState = useLocationHours();
  const comparisonState = useLocationComparison();

  // Memoize context value to prevent unnecessary re-renders
  const contextValue: LocationContextValue = useMemo(() => ({
    // Core state from useLocation
    currentLocation: locationState.currentLocation,
    locationInfo: locationState.locationInfo,
    setLocation: locationState.setLocation,
    toggleLocation: locationState.toggleLocation,
    isOpen: locationState.isOpen,
    todaysHours: locationState.todaysHours,
    nextOpening: locationState.nextOpening,
    hasFeature: locationState.hasFeature as (feature: LocationFeature) => boolean,
    getLocation: locationState.getLocation,
    isClient: locationState.isClient,

    // Hours state
    hours: hoursState,

    // Comparison state
    comparison: comparisonState,
  }), [locationState, hoursState, comparisonState]);

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
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
 * Hook to access location state with optional default location
 * Provides a safe way to access location context with fallbacks
 *
 * @deprecated This function is not currently used and has been disabled
 * due to React Hooks violations. Use useLocationContext() instead.
 */
// export function useLocationState(fallbackLocation?: Location) {
//   const context = useContext(LocationContext);
//   if (!context) {
//     throw new Error('useLocationState must be used within a LocationProvider');
//   }
//   return context;
// }

/**
 * Higher-order component to provide location context
 */
export function withLocationProvider<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <LocationProvider>
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
  location?: Location | Location[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function LocationConditional({
  location,
  fallback = null,
  children
}: LocationConditionalProps) {
  const { currentLocation } = useLocationContext();

  if (!location) {
    return <>{children}</>;
  }

  const targetLocations = Array.isArray(location) ? location : [location];
  const shouldRender = targetLocations.includes(currentLocation);

  return shouldRender ? <>{children}</> : <>{fallback}</>;
}

/**
 * Component to render location-specific content
 */
interface LocationSpecificProps {
  lawrenceville?: ReactNode;
  zelienople?: ReactNode;
  fallback?: ReactNode;
}

export function LocationSpecific({
  lawrenceville,
  zelienople,
  fallback = null
}: LocationSpecificProps) {
  const { currentLocation } = useLocationContext();

  switch (currentLocation) {
    case Location.LAWRENCEVILLE:
      return lawrenceville ? <>{lawrenceville}</> : <>{fallback}</>;
    case Location.ZELIENOPLE:
      return zelienople ? <>{zelienople}</> : <>{fallback}</>;
    default:
      return <>{fallback}</>;
  }
}

/**
 * Hook for location-aware routing and navigation
 */
export function useLocationRouting() {
  const { currentLocation, setLocation } = useLocationContext();

  const getLocationPath = (path: string, location?: Location) => {
    const targetLocation = location || currentLocation;
    return `/${targetLocation}${path.startsWith('/') ? path : `/${path}`}`;
  };

  const navigateWithLocation = (path: string, location?: Location) => {
    const locationPath = getLocationPath(path, location);
    // This would integrate with Next.js router
    return locationPath;
  };

  return {
    currentLocation,
    setLocation,
    getLocationPath,
    navigateWithLocation
  };
}