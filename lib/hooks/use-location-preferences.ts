'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'lolev-location-preferences'

interface LocationPreferences {
  type: 'geolocation' | 'search' | null
  searchTerm?: string
  coordinates?: { latitude: number; longitude: number }
  timestamp: number
}

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function useLocationPreferences() {
  const [preferences, setPreferences] = useState<LocationPreferences | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed: LocationPreferences = JSON.parse(stored)
        // Check if preferences are still valid (not too old)
        if (Date.now() - parsed.timestamp < MAX_AGE_MS) {
          setPreferences(parsed)
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    } catch {
      // Ignore localStorage errors
    }
    setIsLoaded(true)
  }, [])

  // Save geolocation preference
  const saveGeolocationPreference = useCallback((coords: { latitude: number; longitude: number }) => {
    const prefs: LocationPreferences = {
      type: 'geolocation',
      coordinates: coords,
      timestamp: Date.now(),
    }
    setPreferences(prefs)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  // Save search preference
  const saveSearchPreference = useCallback((searchTerm: string, coords: { latitude: number; longitude: number }) => {
    const prefs: LocationPreferences = {
      type: 'search',
      searchTerm,
      coordinates: coords,
      timestamp: Date.now(),
    }
    setPreferences(prefs)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  // Clear preferences
  const clearPreferences = useCallback(() => {
    setPreferences(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  return {
    preferences,
    isLoaded,
    saveGeolocationPreference,
    saveSearchPreference,
    clearPreferences,
  }
}
