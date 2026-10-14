/**
 * Location Context Provider
 * Provides global location state management throughout the application
 * Locations are dynamically loaded from the database
 */

'use client'

import React, { createContext, useContext, ReactNode, useEffect, useMemo, Suspense } from 'react'
import { useQueryState, parseAsString } from 'nuqs'
import {
  type PayloadLocation,
  type LocationSlug,
  type LocationInfo,
  type Weekday,
} from '@/lib/types/location'
import {
  getAllHoursForLocation,
  getFormattedHoursForDay,
  getNextOpeningTimeForLocation,
  isLocationOpenNow,
} from '@/lib/config/locations'
import {
  publishUrlLocation,
  registerUrlLocationSetter,
  useLocationWithoutUrl,
} from '@/lib/hooks/use-location'

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
    getHoursForDay: (day: Weekday) => string
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
 * Reads `?loc=` inside its own Suspense boundary. The page body is a sibling,
 * so a search-param bailout does not drop the document HTML.
 */
function LocationUrlSync() {
  const [urlLocation, setUrlLocation] = useQueryState('loc', parseAsString)

  useEffect(() => {
    publishUrlLocation(urlLocation)
  }, [urlLocation])

  useEffect(() => {
    return registerUrlLocationSetter((value) => {
      void setUrlLocation(value)
    })
  }, [setUrlLocation])

  return null
}

/**
 * Location state for the public site. `?loc=` is read in a nested Suspense
 * boundary so the page body still prerenders. This component does not call
 * useSearchParams; LocationUrlSync is a sibling of `children`.
 */
export function LocationProvider({ children, locations }: LocationProviderProps) {
  const locationState = useLocationWithoutUrl(locations)
  const target = locationState.currentLocationData
  const hoursState = useMemo(
    () => ({
      getHoursForDay: (day: Weekday) =>
        target ? getFormattedHoursForDay(target, day) : 'Hours unavailable',
      getAllHours: () => (target ? getAllHoursForLocation(target) : []),
      isOpen: target ? isLocationOpenNow(target) : false,
      nextOpening: target ? getNextOpeningTimeForLocation(target) : null,
    }),
    [target],
  )

  const contextValue: LocationContextValue = useMemo(
    () => ({
      ...locationState,
      hours: hoursState,
    }),
    [locationState, hoursState],
  )

  return (
    <LocationContext.Provider value={contextValue}>
      <Suspense fallback={null}>
        <LocationUrlSync />
      </Suspense>
      {children}
    </LocationContext.Provider>
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
