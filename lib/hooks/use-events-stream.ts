'use client'

import { usePolling } from './use-polling'
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

/** Domain data extracted from EventsResponse for state management */
interface EventsData {
  events: BreweryEvent[]
  locationName: string
}

interface EventsResponse {
  events: BreweryEvent[]
  locationName: string
  theme: 'light' | 'dark'
  timestamp: number
  deployId?: string
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
  options: UseEventsStreamOptions = {}
): UseEventsStreamResult {
  const initialData: EventsData = { events: initialEvents, locationName: initialLocationName }

  const { data, theme, isConnected, error, pollCount } = usePolling<EventsData, EventsResponse>(
    location ? `/api/events-stream/${location}` : '',
    initialData,
    (response) => ({
      data: { events: response.events, locationName: response.locationName },
      theme: response.theme,
    }),
    options
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
