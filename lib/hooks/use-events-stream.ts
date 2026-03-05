'use client'

import { useMemo } from 'react'

import { usePolling, type UsePollingOptions } from './use-polling'
import type { BreweryEvent } from '@/lib/types/event'

interface UseEventsStreamResult {
  events: BreweryEvent[]
  locationName: string
  theme: 'light' | 'dark'
  isConnected: boolean
  error: Error | null
  pollCount: number
}

/** Domain data managed by the polling hook */
interface EventsData {
  events: BreweryEvent[]
  locationName: string
}

/** Shape of the /api/events-stream response */
interface EventsResponse {
  events: BreweryEvent[]
  locationName: string
  theme: 'light' | 'dark'
  timestamp: number
  deployId?: string
  warm?: boolean
}

/**
 * Hook for real-time events updates via adaptive polling.
 *
 * Wraps the generic usePolling hook with events-specific data transformation.
 * See usePolling for details on adaptive interval behavior and CDN caching strategy.
 */
export function useEventsStream(
  location: string,
  initialEvents: BreweryEvent[],
  initialLocationName: string,
  options: UsePollingOptions = {},
): UseEventsStreamResult {
  const initialData = useMemo<EventsData>(
    () => ({ events: initialEvents, locationName: initialLocationName }),
    [initialEvents, initialLocationName],
  )

  const { data, theme, isConnected, error, pollCount } = usePolling<EventsData, EventsResponse>(
    location ? `/api/events-stream/${location}` : '',
    initialData,
    ({ events, locationName, theme: responseTheme }) => ({
      data: { events, locationName },
      theme: responseTheme,
    }),
    options,
  )

  return {
    events: data?.events ?? initialEvents,
    locationName: data?.locationName ?? initialLocationName,
    theme,
    isConnected,
    error,
    pollCount,
  }
}
