'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { BreweryEvent } from '@/lib/types/event'

interface UseEventsStreamOptions {
  /** Whether streaming is enabled (default: true) */
  enabled?: boolean
  /** Base poll interval in ms (default: 5000) */
  pollInterval?: number
}

interface UseEventsStreamResult {
  events: BreweryEvent[]
  locationName: string
  theme: 'light' | 'dark'
  isConnected: boolean
  error: Error | null
  pollCount: number
}

interface EventsResponse {
  events: BreweryEvent[]
  locationName: string
  theme: 'light' | 'dark'
  timestamp: number
  deployId?: string
}

// Adaptive polling thresholds
const SLOW_AFTER = 30
const SLOWER_AFTER = 90
const MEDIUM_MULTIPLIER = 2.5
const SLOW_MULTIPLIER = 5

/**
 * Hook for real-time events updates via adaptive polling
 */
export function useEventsStream(
  location: string,
  initialEvents: BreweryEvent[],
  initialLocationName: string,
  options: UseEventsStreamOptions = {}
): UseEventsStreamResult {
  const { enabled = true, pollInterval = 5000 } = options

  const [events, setEvents] = useState<BreweryEvent[]>(initialEvents)
  const [locationName, setLocationName] = useState(initialLocationName)
  const [theme, setThemeState] = useState<'light' | 'dark'>('light')
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [pollCount, setPollCount] = useState(0)

  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTimestampRef = useRef<number>(0)
  const deployIdRef = useRef<string | null>(null)
  const noChangeCountRef = useRef<number>(0)

  const getAdaptiveInterval = useCallback((noChangeCount: number) => {
    if (noChangeCount >= SLOWER_AFTER) return pollInterval * SLOW_MULTIPLIER
    if (noChangeCount >= SLOW_AFTER) return pollInterval * MEDIUM_MULTIPLIER
    return pollInterval
  }, [pollInterval])

  const poll = useCallback(async () => {
    if (!location || !enabled) return

    try {
      const response = await fetch(`/api/events-stream/${location}`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data: EventsResponse = await response.json()

      // Detect new deployment and force a full page reload
      if (data.deployId) {
        if (deployIdRef.current === null) {
          deployIdRef.current = data.deployId
        } else if (data.deployId !== deployIdRef.current) {
          window.location.reload()
          return
        }
      }

      // Only update if data has changed
      if (data.timestamp !== lastTimestampRef.current) {
        lastTimestampRef.current = data.timestamp
        setEvents(data.events)
        setLocationName(data.locationName)
        noChangeCountRef.current = 0
      } else {
        noChangeCountRef.current += 1
      }

      setThemeState(data.theme)
      setIsConnected(true)
      setError(null)
      setPollCount(prev => prev + 1)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch events'))
      setIsConnected(false)
    }

    // Schedule next poll with adaptive interval
    if (enabled) {
      const nextInterval = getAdaptiveInterval(noChangeCountRef.current)
      pollTimeoutRef.current = setTimeout(poll, nextInterval)
    }
  }, [location, enabled, pollInterval, getAdaptiveInterval])

  // Start polling on mount
  useEffect(() => {
    if (enabled && location) {
      poll()
    }

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
        pollTimeoutRef.current = null
      }
    }
  }, [enabled, location, poll])

  // Update events when initial data changes
  useEffect(() => {
    if (initialEvents) {
      setEvents(initialEvents)
    }
  }, [initialEvents])

  return { events, locationName, theme, isConnected, error, pollCount }
}
