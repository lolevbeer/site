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

/** No-change poll counts before slowing down */
const SLOW_AFTER = 30
const SLOWER_AFTER = 90

/** Multipliers applied to the base poll interval at each slowdown tier */
const MEDIUM_MULTIPLIER = 2.5
const SLOW_MULTIPLIER = 5

interface PollingResponse {
  timestamp: number
  deployId?: string
  /** When true, server signals an editor is active (snap back to fast polling) */
  warm?: boolean
}

export interface UsePollingOptions {
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
 * Compute the next poll delay based on how many consecutive polls returned
 * unchanged data. Slows from base -> 2.5x -> 5x as idle time increases.
 */
function getAdaptiveInterval(baseInterval: number, noChangeCount: number): number {
  if (noChangeCount >= SLOWER_AFTER) return baseInterval * SLOW_MULTIPLIER
  if (noChangeCount >= SLOW_AFTER) return baseInterval * MEDIUM_MULTIPLIER
  return baseInterval
}

/**
 * Generic adaptive polling hook.
 *
 * Polls a URL at an adaptive interval, slowing down when no changes are
 * detected and snapping back to the base interval when data changes or
 * the server signals an active editor.
 *
 * Handles deploy detection (page reload on new deploy) and timestamp-based
 * change detection to avoid unnecessary state updates.
 *
 * @param url - API endpoint to poll (empty string disables polling)
 * @param initialData - Initial data to use before first successful poll (null if unavailable)
 * @param applyResponse - Callback to extract domain data and theme from the raw response
 * @param options - Polling configuration
 */
export function usePolling<T, R extends PollingResponse>(
  url: string,
  initialData: T | null,
  applyResponse: (response: R) => { data: T; theme: 'light' | 'dark' },
  options: UsePollingOptions = {},
): UsePollingResult<T> {
  const { enabled = true, pollInterval = 2000 } = options

  const [data, setData] = useState<T | null>(initialData)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [pollCount, setPollCount] = useState(0)

  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTimestampRef = useRef(0)
  const deployIdRef = useRef<string | null>(null)
  const noChangeCountRef = useRef(0)

  // Store applyResponse in a ref so poll() always uses the latest callback
  // without needing it in the useCallback dependency array.
  const applyResponseRef = useRef(applyResponse)
  applyResponseRef.current = applyResponse

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

      const applied = applyResponseRef.current(raw)

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
      setPollCount((prev) => prev + 1)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Polling failed'))
      setIsConnected(false)
    }

    // Schedule next poll with adaptive interval
    if (enabled) {
      const nextInterval = getAdaptiveInterval(pollInterval, noChangeCountRef.current)
      pollTimeoutRef.current = setTimeout(poll, nextInterval)
    }
  }, [url, enabled, pollInterval])

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
