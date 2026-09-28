/**
 * Custom hook for location state management
 * Provides location state with localStorage persistence, URL sync, and helper functions
 * Locations are now dynamically loaded from the database
 */

'use client'

import { useEffect, useCallback, useMemo, useSyncExternalStore } from 'react'
import { useQueryState, parseAsString } from 'nuqs'
import { useIsHydrated } from '@/lib/hooks/use-is-hydrated'
import {
  type PayloadLocation,
  type LocationSlug,
  type LocationInfo,
  WEEKDAYS_FROM_SUNDAY,
  toLocationInfo,
} from '@/lib/types/location'
import {
  LOCATION_STORAGE_KEY,
  isLocationOpenNow,
  getFormattedHoursForDay,
  getNextOpeningTimeForLocation,
  getDefaultLocationSlug,
  findLocationBySlug,
  isValidLocationSlug,
} from '@/lib/config/locations'

export interface UseLocationReturn {
  /** Current selected location slug */
  currentLocation: LocationSlug
  /** Current location data from Payload */
  currentLocationData: PayloadLocation | null
  /** Location information for current location */
  locationInfo: LocationInfo | null
  /** All available locations */
  locations: PayloadLocation[]
  /** Set the current location and persist to localStorage */
  setLocation: (slug: LocationSlug) => void
  /** Switch to the next location */
  cycleLocation: () => void
  /** Whether the current location is open now */
  isOpen: boolean
  /** Formatted hours for today */
  todaysHours: string
  /** Next opening time if currently closed */
  nextOpening: { day: string; time: string } | null
  /** Get location data by slug */
  getLocationBySlug: (slug: LocationSlug) => PayloadLocation | undefined
  /** Get location info by slug */
  getLocationInfo: (slug: LocationSlug) => LocationInfo | null
  /** Whether we're on the client (hydration check) */
  isClient: boolean
}

/**
 * localStorage is treated as the store of record for the location preference
 * rather than being copied into React state on mount. Copying meant a
 * setState inside an effect (flagged by react-hooks/set-state-in-effect) and
 * a duplicate source of truth; subscribing keeps the selection derived, and
 * picks up changes from other tabs for free.
 */
const storageListeners = new Set<() => void>()

function subscribeToStoredLocation(listener: () => void): () => void {
  storageListeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    storageListeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function getStoredLocationSnapshot(): string | null {
  try {
    return localStorage.getItem(LOCATION_STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to read location from localStorage:', error)
    return null
  }
}

/** The server has no preference, so SSR and the hydration render agree. */
function getStoredLocationServerSnapshot(): string | null {
  return null
}

/**
 * `loc` query value, published by LocationUrlSync. The provider reads this
 * store instead of calling useSearchParams, so the page HTML can prerender.
 * Server snapshot is null: the first client render matches the document.
 */
let publishedUrlLocation: string | null = null
const urlLocationListeners = new Set<() => void>()
const urlLocationSetters = new Set<(value: string | null) => void>()

function subscribeToUrlLocation(listener: () => void): () => void {
  urlLocationListeners.add(listener)
  return () => urlLocationListeners.delete(listener)
}

function getUrlLocationSnapshot(): string | null {
  return publishedUrlLocation
}

function getUrlLocationServerSnapshot(): string | null {
  return null
}

/** Called by the suspended URL sync after nuqs resolves `loc`. */
export function publishUrlLocation(value: string | null): void {
  if (publishedUrlLocation === value) return
  publishedUrlLocation = value
  urlLocationListeners.forEach((listener) => listener())
}

/** Lets a location change clear `?loc=` without the provider calling nuqs. */
export function registerUrlLocationSetter(setter: (value: string | null) => void): () => void {
  urlLocationSetters.add(setter)
  return () => urlLocationSetters.delete(setter)
}

function writeUrlLocation(value: string | null): void {
  publishUrlLocation(value)
  urlLocationSetters.forEach((setter) => setter(value))
}

/**
 * Save location preference to localStorage
 */
function saveLocationToStorage(slug: LocationSlug): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, slug)
  } catch (error) {
    console.warn('Failed to save location to localStorage:', error)
  }
  // `storage` only fires in other tabs, so notify this one directly.
  storageListeners.forEach((listener) => listener())
}

/**
 * Location state shared by the nuqs-backed hook and the prerender-safe one.
 * `setUrlLocation` clears or replaces the `loc` query.
 */
function useLocationState(
  locations: PayloadLocation[],
  urlLocation: string | null,
  setUrlLocation: (value: string | null) => void,
): UseLocationReturn {
  const defaultSlug = useMemo(() => getDefaultLocationSlug(locations), [locations])
  const isClient = useIsHydrated()

  const storedLocation = useSyncExternalStore(
    subscribeToStoredLocation,
    getStoredLocationSnapshot,
    getStoredLocationServerSnapshot,
  )

  // Priority: URL param > localStorage > default. Derived rather than held in
  // state, so selecting a location is a single write to storage and every
  // consumer re-derives from it.
  const currentLocation = useMemo<LocationSlug>(() => {
    if (locations.length === 0) return defaultSlug
    if (urlLocation && isValidLocationSlug(locations, urlLocation)) return urlLocation
    if (storedLocation && isValidLocationSlug(locations, storedLocation)) return storedLocation
    return defaultSlug
  }, [locations, urlLocation, storedLocation, defaultSlug])

  // Persist a location supplied via the URL so it survives the next visit.
  // A write to an external system is what effects are for.
  useEffect(() => {
    if (locations.length === 0) return
    if (urlLocation && isValidLocationSlug(locations, urlLocation)) {
      saveLocationToStorage(urlLocation)
    }
  }, [urlLocation, locations])

  // Get current location data
  const currentLocationData = useMemo(
    () => findLocationBySlug(locations, currentLocation) || null,
    [locations, currentLocation],
  )

  // Get current location info
  const locationInfo = useMemo(
    () => (currentLocationData ? toLocationInfo(currentLocationData) : null),
    [currentLocationData],
  )

  // Set location with persistence. Clear any URL preset so it cannot keep
  // overriding the visitor's direct selection.
  const setLocation = useCallback(
    (slug: LocationSlug) => {
      if (!isValidLocationSlug(locations, slug)) return
      void setUrlLocation(null)
      // Writing to storage notifies subscribers, and `currentLocation` derives
      // from that — there is no separate copy in state to keep in step.
      saveLocationToStorage(slug)
    },
    [locations, setUrlLocation],
  )

  // Cycle to next location
  const cycleLocation = useCallback(() => {
    const activeLocations = locations.filter((loc) => loc.active !== false)
    if (activeLocations.length <= 1) return

    const currentIndex = activeLocations.findIndex(
      (loc) => loc.slug === currentLocation || loc.id === currentLocation,
    )
    const nextIndex = (currentIndex + 1) % activeLocations.length
    const nextSlug = activeLocations[nextIndex].slug || activeLocations[nextIndex].id
    setLocation(nextSlug)
  }, [locations, currentLocation, setLocation])

  // Check if current location is open
  const isOpen = useMemo(
    () => (currentLocationData ? isLocationOpenNow(currentLocationData) : false),
    [currentLocationData],
  )

  // Get today's hours
  const todaysHours = useMemo(() => {
    if (!currentLocationData) return 'Hours unavailable'
    const dayOfWeek = WEEKDAYS_FROM_SUNDAY[new Date().getDay()]
    return getFormattedHoursForDay(currentLocationData, dayOfWeek)
  }, [currentLocationData])

  // Get next opening time if closed
  const nextOpening = useMemo(
    () =>
      currentLocationData && !isOpen ? getNextOpeningTimeForLocation(currentLocationData) : null,
    [currentLocationData, isOpen],
  )

  // Helper to get location data by slug
  const getLocationBySlug = useCallback(
    (slug: LocationSlug) => findLocationBySlug(locations, slug),
    [locations],
  )

  // Helper to get location info by slug
  const getLocationInfo = useCallback(
    (slug: LocationSlug): LocationInfo | null => {
      const loc = findLocationBySlug(locations, slug)
      return loc ? toLocationInfo(loc) : null
    },
    [locations],
  )

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
    isClient,
  }
}

/**
 * Location state that reads `?loc=` through nuqs.
 * Calling this suspends static prerender up to the nearest Suspense boundary.
 */
export function useLocation(locations: PayloadLocation[] = []): UseLocationReturn {
  const [urlLocation, setUrlLocation] = useQueryState('loc', parseAsString)
  return useLocationState(locations, urlLocation, (value) => {
    void setUrlLocation(value)
  })
}

/**
 * Same state as useLocation, but the URL is a store updated by LocationUrlSync.
 * The provider uses this so the page body is in the prerendered HTML.
 */
export function useLocationWithoutUrl(locations: PayloadLocation[] = []): UseLocationReturn {
  const urlLocation = useSyncExternalStore(
    subscribeToUrlLocation,
    getUrlLocationSnapshot,
    getUrlLocationServerSnapshot,
  )
  return useLocationState(locations, urlLocation, writeUrlLocation)
}
