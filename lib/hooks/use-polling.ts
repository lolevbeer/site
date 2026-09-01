'use client'

/**
 * Shared adaptive polling hook for real-time display updates (menus, events).
 *
 * Cost-effective design:
 * - No query params, so all displays share one CDN cache entry per endpoint
 * - Client-side timestamp comparison avoids unnecessary state updates
 * - 10s warm / 30s idle polling aligned with the shared CDN object
 * @module
 */

import { useState, useEffect, useRef, useCallback } from 'react'

import { selectPollInterval } from '@/lib/hooks/poll-interval'

interface PollingResponse {
  timestamp: number
  deployId?: string
  /** When true, server signals an editor is active (snap back to fast polling) */
  warm?: boolean
}

export interface UsePollingOptions {
  /** Whether polling is enabled (default: true) */
  enabled?: boolean
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
 * @param applyResponse - Callback to extract domain data and theme from the raw response.
 *   Must return `{ data, theme }` — null returns are not supported.
 * @param options - Polling configuration
 */
export function usePolling<T, R extends PollingResponse>(
  url: string,
  initialData: T | null,
  applyResponse: (response: R) => { data: T; theme: 'light' | 'dark' },
  options: UsePollingOptions = {},
): UsePollingResult<T> {
  const { enabled = true } = options

  // A poll result is stored together with the server-supplied `initialData` it
  // was layered on top of. When the server re-renders with fresh props that
  // base stops matching, so the newer server data wins automatically — where
  // previously an effect copied the prop into state on every change, which
  // react-hooks/set-state-in-effect flags.
  const [polled, setPolled] = useState<{ base: T | null; value: T } | null>(null)
  const data = polled && polled.base === initialData ? polled.value : initialData
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [pollCount, setPollCount] = useState(0)

  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastTimestampRef = useRef(0)
  const deployIdRef = useRef<string | null>(null)
  const noChangeCountRef = useRef(0)
  const consecutiveErrorsRef = useRef(0)
  const successfulPollsRef = useRef(0)
  const lastWarmRef = useRef(false)
  const generationRef = useRef(0)

  // Store applyResponse in a ref so poll() always uses the latest callback
  // without needing it in the useCallback dependency array. Written in an
  // effect rather than during render: render-phase ref mutation is unsafe when
  // React retries a render, and is flagged by react-hooks/refs.
  const applyResponseRef = useRef(applyResponse)
  // Read inside poll() so a result records which server render it superseded,
  // without `initialData` in poll's dependency list restarting the timer on
  // every server re-render.
  const initialDataRef = useRef(initialData)
  useEffect(() => {
    applyResponseRef.current = applyResponse
    initialDataRef.current = initialData
  })

  // poll() reschedules itself, which it cannot do by referencing its own
  // binding from inside its initializer. Going through a ref also means a
  // pending timeout always fires the newest poll rather than a stale closure.
  const pollRef = useRef<() => void>(() => {})

  const poll = useCallback(async () => {
    if (!url || !enabled) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const generation = ++generationRef.current

    try {
      const response = await fetch(url, { signal: controller.signal })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const raw: R = await response.json()
      if (generation !== generationRef.current) return

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
      lastWarmRef.current = Boolean(raw.warm)
      if (raw.timestamp !== lastTimestampRef.current) {
        lastTimestampRef.current = raw.timestamp
        setPolled({ base: initialDataRef.current, value: applied.data })
        noChangeCountRef.current = 0
      } else if (raw.warm) {
        noChangeCountRef.current = 0
      } else {
        noChangeCountRef.current += 1
      }

      // Always update theme (handles time-of-day transitions even without data changes)
      setTheme(applied.theme)

      consecutiveErrorsRef.current = 0
      successfulPollsRef.current += 1
      setIsConnected(true)
      setError(null)
      setPollCount((prev) => prev + 1)
    } catch (err) {
      if (controller.signal.aborted || generation !== generationRef.current) return
      consecutiveErrorsRef.current += 1
      lastWarmRef.current = false
      setError(err instanceof Error ? err : new Error('Polling failed'))
      setIsConnected(false)
    }

    if (generation !== generationRef.current) return
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
    if (!enabled) return
    const nextInterval = selectPollInterval({
      noChangeCount: noChangeCountRef.current,
      warm: lastWarmRef.current,
      consecutiveErrors: consecutiveErrorsRef.current,
      hidden: document.hidden,
      isInitial: successfulPollsRef.current === 1,
    })
    if (nextInterval === null) return
    pollTimeoutRef.current = setTimeout(() => pollRef.current(), nextInterval)
  }, [url, enabled])

  useEffect(() => {
    pollRef.current = poll
  })

  useEffect(() => {
    if (enabled && url) {
      poll()
    }

    const onVisibility = () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
        pollTimeoutRef.current = null
      }
      if (document.hidden) {
        abortRef.current?.abort()
        return
      }
      noChangeCountRef.current = 0
      lastWarmRef.current = true
      if (enabled && url) pollRef.current()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      abortRef.current?.abort()
      generationRef.current += 1
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
        pollTimeoutRef.current = null
      }
    }
  }, [enabled, url, poll])

  return { data, theme, isConnected, error, pollCount }
}
