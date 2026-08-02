/**
 * Location Context Provider
 * Provides global location state management throughout the application
 * Locations are dynamically loaded from the database
 */

'use client'

import React, { createContext, useContext, ReactNode, useMemo, Suspense } from 'react'
import { type PayloadLocation, type LocationSlug, type LocationInfo } from '@/lib/types/location'
import { useLocation, useLocationHours } from '@/lib/hooks/use-location'

interface LocationContextValue {
  // Core location state
  currentLocation: LocationSlug
  currentLocationData: PayloadLocation | null
  locationInfo: LocationInfo | null
  locations: PayloadLocation[]
  setLocation: (slug: LocationSlug) => void
  cycleLocation: () => void

  // Status information
  isOpen: boolean
  todaysHours: string
  nextOpening: { day: string; time: string } | null

  // Helper functions
  getLocationBySlug: (slug: LocationSlug) => PayloadLocation | undefined
  getLocationInfo: (slug: LocationSlug) => LocationInfo | null
  isClient: boolean

  // Hours management
  hours: {
    getHoursForDay: (day: string) => string
    getAllHours: () => Array<{
      day: string
      hours: string
      isToday: boolean
    }>
    isOpen: boolean
    nextOpening: { day: string; time: string } | null
  }
}

const LocationContext = createContext<LocationContextValue | null>(null)

interface LocationProviderProps {
  children: ReactNode
  /** Locations fetched from the database (passed from server) */
  locations: PayloadLocation[]
}

/**
 * Inner provider component that uses hooks requiring useSearchParams
 * This is wrapped in Suspense to support static generation
 */
function LocationProviderInner({ children, locations }: LocationProviderProps) {
  const locationState = useLocation(locations)
  const hoursState = useLocationHours(locations)

  // Memoize context value to prevent unnecessary re-renders
  const contextValue: LocationContextValue = useMemo(
    () => ({
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
    }),
    [locationState, hoursState],
  )

  return <LocationContext.Provider value={contextValue}>{children}</LocationContext.Provider>
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
  )
}

/**
 * Hook to use the location context
 * Throws error if used outside of LocationProvider
 */
export function useLocationContext(): LocationContextValue {
  const context = useContext(LocationContext)

  if (!context) {
    throw new Error('useLocationContext must be used within a LocationProvider')
  }

  return context
}
