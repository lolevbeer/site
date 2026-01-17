'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { BreweryEvent } from '@/lib/types/event'

interface UseEventsStreamOptions {
  /** Whether streaming is enabled (default: true) */
  enabled?: boolean
  /** Poll interval in ms (default: 5000) */
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
}

/**
 * Hook for real-time events updates via polling
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

      // Only update if data has changed
      if (data.timestamp !== lastTimestampRef.current) {
        lastTimestampRef.current = data.timestamp
        setEvents(data.events)
        setLocationName(data.locationName)
      }

      setThemeState(data.theme)
      setIsConnected(true)
      setError(null)
      setPollCount(prev => prev + 1)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch events'))
      setIsConnected(false)
    }

    // Schedule next poll
    if (enabled) {
      pollTimeoutRef.current = setTimeout(poll, pollInterval)
    }
  }, [location, enabled, pollInterval])

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
