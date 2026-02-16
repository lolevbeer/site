/**
 * Generic adaptive polling hook extracted from use-menu-stream and use-events-stream.
 *
 * Cost-effective design:
 * - No query params, so all displays share one CDN cache entry per endpoint
 * - Client-side timestamp comparison avoids unnecessary state updates
 * - Adaptive polling reduces idle-time requests by 50-80%
 */
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// Adaptive polling thresholds
const SLOW_AFTER = 30 // no-change polls before slowing to medium
const SLOWER_AFTER = 90 // no-change polls before slowing to slow
const MEDIUM_MULTIPLIER = 2.5 // e.g. 2s -> 5s
const SLOW_MULTIPLIER = 5 // e.g. 2s -> 10s

interface PollingResponse {
  timestamp: number
  deployId?: string
  /** When true, server signals an editor is active (snap back to fast polling) */
  warm?: boolean
}

interface UsePollingOptions {
  /** Whether polling is enabled (default: true) */
  enabled?: boolean
  /** Base poll interval in ms (default: 2000) */
  pollInterval?: number
}

interface UsePollingResult<T> {
  data: T | null
  theme: 'light' | 'dark'
  isConnected: boolean
  error: Error | null
  /** Increments on each successful poll */
  pollCount: number
}

/**
 * Generic adaptive polling hook
 *
 * Polls a URL at an adaptive interval, slowing down when no changes are
 * detected and snapping back to the base interval when data changes or
 * the server signals an active editor.
 *
 * Handles deploy detection (page reload on new deploy) and timestamp-based
 * change detection to avoid unnecessary state updates.
 *
 * @param url - API endpoint to poll (null/empty disables polling)
 * @param initialData - Initial data to use before first successful poll (null if unavailable)
 * @param applyResponse - Callback to extract domain data and theme from the raw response.
 *   Return the new data value, or null to skip the update.
 * @param options - Polling configuration
 */
export function usePolling<T, R extends PollingResponse>(
  url: string,
  initialData: T | null,
  applyResponse: (response: R) => { data: T; theme: 'light' | 'dark' },
  options: UsePollingOptions = {}
): UsePollingResult<T> {
  const { enabled = true, pollInterval = 2000 } = options

  const [data, setData] = useState<T | null>(initialData)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [pollCount, setPollCount] = useState(0)

  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTimestampRef = useRef<number>(0)
  const deployIdRef = useRef<string | null>(null)
  const noChangeCountRef = useRef<number>(0)

  const getAdaptiveInterval = useCallback(
    (noChangeCount: number): number => {
      if (noChangeCount >= SLOWER_AFTER) return pollInterval * SLOW_MULTIPLIER
      if (noChangeCount >= SLOW_AFTER) return pollInterval * MEDIUM_MULTIPLIER
      return pollInterval
    },
    [pollInterval],
  )

  const poll = useCallback(async () => {
    if (!url || !enabled) return

    try {
      const response = await fetch(url, { cache: 'no-store' })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const raw: R = await response.json()

      // Detect new deployment and force a full page reload
      if (raw.deployId) {
        if (deployIdRef.current === null) {
          deployIdRef.current = raw.deployId
        } else if (raw.deployId !== deployIdRef.current) {
          window.location.reload()
          return
        }
      }

      const applied = applyResponse(raw)

      // Only update data state when timestamp has changed
      if (raw.timestamp !== lastTimestampRef.current) {
        lastTimestampRef.current = raw.timestamp
        setData(applied.data)
        noChangeCountRef.current = 0
      } else if (raw.warm) {
        // Editor is active -- snap back to fast polling to catch upcoming changes
        noChangeCountRef.current = 0
      } else {
        noChangeCountRef.current += 1
      }

      // Always update theme (handles time-of-day transitions even without data changes)
      setTheme(applied.theme)

      setIsConnected(true)
      setError(null)
      setPollCount(prev => prev + 1)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Polling failed'))
      setIsConnected(false)
    }

    // Schedule next poll with adaptive interval
    if (enabled) {
      const nextInterval = getAdaptiveInterval(noChangeCountRef.current)
      pollTimeoutRef.current = setTimeout(poll, nextInterval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled, pollInterval, getAdaptiveInterval])

  // Start polling on mount
  useEffect(() => {
    if (enabled && url) {
      poll()
    }

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
        pollTimeoutRef.current = null
      }
    }
  }, [enabled, url, poll])

  // Sync with server re-renders of initial data
  useEffect(() => {
    if (initialData != null) {
      setData(initialData)
    }
  }, [initialData])

  return { data, theme, isConnected, error, pollCount }
}
