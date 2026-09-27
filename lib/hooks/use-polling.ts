'use client'

/**
 * Shared polling hook for real-time display updates (menus, events).
 *
 * Implements the "Polling state machine" in
 * docs/superpowers/specs/2026-09-01-vercel-efficiency-design.md:
 * - 10s right after mount, a change, or while content changed within the last
 *   minute ("warm"); 30s once idle
 * - 30s / 60s / 120s backoff on consecutive errors
 * - no polling while the tab is hidden; an immediate poll when it is shown
 *
 * Cost-effective design:
 * - No query params, so all displays share one CDN cache entry per endpoint
 * - The endpoints are CDN-cached until content changes, and polls revalidate
 *   (`cache: 'no-cache'`), so an unchanged poll can be a 304 with no body
 * - `warm` and the display theme are worked out here from the content
 *   timestamp and the clock, so responses carry nothing clock-dependent
 * - Client-side timestamp comparison avoids unnecessary state updates
 * @module
 */

import { useState, useEffect, useRef, useCallback } from 'react'

export const FAST_INTERVAL_MS = 10_000
export const IDLE_INTERVAL_MS = 30_000
/** Content changed this recently counts as "warm": an editor is likely still at it. */
export const WARM_WINDOW_MS = 60_000
/** Delay after the 1st, 2nd, and 3rd-or-later consecutive failed poll. */
const ERROR_BACKOFF_MS = [30_000, 60_000, 120_000] as const

interface PollingResponse {
  timestamp: number
  deployId?: string
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

interface PollState {
  /** Consecutive successful polls whose content timestamp didn't change */
  noChangeCount: number
  /** The content changed within WARM_WINDOW_MS */
  warm: boolean
  consecutiveErrors: number
  hidden: boolean
}

/**
 * The delay before the next poll, or null to schedule none (hidden tab).
 * Pure, so the polling rhythm is testable without timers.
 */
export function selectPollInterval({
  noChangeCount,
  warm,
  consecutiveErrors,
  hidden,
}: PollState): number | null {
  if (hidden) return null
  if (consecutiveErrors > 0) {
    return ERROR_BACKOFF_MS[Math.min(consecutiveErrors, ERROR_BACKOFF_MS.length) - 1]
  }
  if (warm || noChangeCount === 0) return FAST_INTERVAL_MS
  return IDLE_INTERVAL_MS
}

/**
 * Generic display polling hook; see the module comment for the rhythm.
 *
 * Handles deploy detection (page reload on new deploy) and timestamp-based
 * change detection to avoid unnecessary state updates.
 *
 * @param url - API endpoint to poll (empty string disables polling)
 * @param initialData - Initial data to use before first successful poll (null if unavailable)
 * @param applyResponse - Callback to extract domain data from the raw response and work
 *   out the display theme (on the client, since responses stay cacheable and carry
 *   no clock-dependent fields). Must return `{ data, theme }` — null returns are
 *   not supported.
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
  const lastTimestampRef = useRef(0)
  const deployIdRef = useRef<string | null>(null)
  const noChangeCountRef = useRef(0)
  const warmRef = useRef(false)
  const consecutiveErrorsRef = useRef(0)

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

  const clearScheduledPoll = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
  }, [])

  const poll = useCallback(async () => {
    if (!url || !enabled) return

    try {
      // 'no-cache' revalidates with the CDN (If-None-Match), so an unchanged
      // cached response comes back as a 304 with no body.
      const response = await fetch(url, { cache: 'no-cache' })

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
        setPolled({ base: initialDataRef.current, value: applied.data })
        noChangeCountRef.current = 0
      } else {
        noChangeCountRef.current += 1
      }
      warmRef.current = raw.timestamp > 0 && Date.now() - raw.timestamp < WARM_WINDOW_MS
      consecutiveErrorsRef.current = 0

      // Always update theme: applyResponse reads the clock, so day/night changes
      // land on the next poll even when the data hasn't changed.
      setTheme(applied.theme)

      setIsConnected(true)
      setError(null)
      setPollCount((prev) => prev + 1)
    } catch (err) {
      consecutiveErrorsRef.current += 1
      setError(err instanceof Error ? err : new Error('Polling failed'))
      setIsConnected(false)
    }

    if (enabled) {
      const delay = selectPollInterval({
        noChangeCount: noChangeCountRef.current,
        warm: warmRef.current,
        consecutiveErrors: consecutiveErrorsRef.current,
        hidden: document.hidden,
      })
      if (delay !== null) {
        pollTimeoutRef.current = setTimeout(() => pollRef.current(), delay)
      }
    }
  }, [url, enabled])

  useEffect(() => {
    pollRef.current = poll
  })

  useEffect(() => {
    if (enabled && url) {
      poll()
    }

    return clearScheduledPoll
  }, [enabled, url, poll, clearScheduledPoll])

  // Hidden tabs don't poll; showing the tab polls at once and resumes fast.
  useEffect(() => {
    if (!enabled || !url) return

    const onVisibilityChange = () => {
      clearScheduledPoll()
      if (!document.hidden) {
        noChangeCountRef.current = 0
        void pollRef.current()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [enabled, url, clearScheduledPoll])

  return { data, theme, isConnected, error, pollCount }
}
