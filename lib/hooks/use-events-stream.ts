'use client'

import { useMemo } from 'react'

import { useAblyInvalidate } from './use-ably-invalidate'
import { usePolling } from './use-polling'
import type { BreweryEvent } from '@/lib/types/event'
import { getPittsburghTheme } from '@/lib/utils/pittsburgh-time'

interface UseEventsStreamResult {
  events: BreweryEvent[]
  locationName: string
  theme: 'light' | 'dark'
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
  timestamp: number
  deployId?: string
}

/**
 * Hook for real-time events updates via adaptive polling, with an optional
 * Ably invalidate path (NEXT_PUBLIC_ABLY_ENABLED) that forces an immediate
 * poll when CMS revalidation publishes to kiosk:events.
 *
 * Wraps the generic usePolling hook with events-specific data transformation.
 * The Pittsburgh day/night theme is worked out here because the cached
 * response carries no clock. See usePolling for interval and caching details.
 */
export function useEventsStream(
  location: string,
  initialEvents: BreweryEvent[],
  initialLocationName: string,
): UseEventsStreamResult {
  const initialData = useMemo<EventsData>(
    () => ({ events: initialEvents, locationName: initialLocationName }),
    [initialEvents, initialLocationName],
  )
  const { invalidateSignal, realtimeActive } = useAblyInvalidate({
    kind: 'events',
    key: location,
  })

  const { data, theme } = usePolling<EventsData, EventsResponse>(
    location ? `/api/events-stream/${location}` : '',
    initialData,
    ({ events, locationName }) => ({
      data: { events, locationName },
      theme: getPittsburghTheme(),
    }),
    { invalidateSignal, realtimeFallback: realtimeActive },
  )

  return {
    events: data?.events ?? initialEvents,
    locationName: data?.locationName ?? initialLocationName,
    theme,
  }
}
