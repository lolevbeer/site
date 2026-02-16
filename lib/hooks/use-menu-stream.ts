'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Menu } from '@/src/payload-types'

interface UseMenuStreamOptions {
  /** Whether streaming is enabled (default: true) */
  enabled?: boolean
  /** Base poll interval in ms (default: 2000) */
  pollInterval?: number
}

interface UseMenuStreamResult {
  menu: Menu | null
  theme: 'light' | 'dark'
  isConnected: boolean
  error: Error | null
  /** Increments on each successful poll - useful for cycling effects */
  pollCount: number
}

interface MenuResponseFull {
  changed: true
  menu: Menu
  theme: 'light' | 'dark'
  timestamp: number
  deployId?: string
  warm?: boolean
}

interface MenuResponseNoChange {
  changed: false
  theme: 'light' | 'dark'
  timestamp: number
  deployId?: string
  warm?: boolean
}

type MenuResponse = MenuResponseFull | MenuResponseNoChange

// Adaptive polling thresholds
const SLOW_AFTER = 30 // no-change polls before slowing to medium
const SLOWER_AFTER = 90 // no-change polls before slowing to slow
const MEDIUM_MULTIPLIER = 2.5 // 2s -> 5s
const SLOW_MULTIPLIER = 5 // 2s -> 10s

/**
 * Hook for real-time menu updates via polling
 *
 * Uses adaptive polling against a cached endpoint for cost-effective updates.
 * Starts at the base interval, then slows down when no changes are detected.
 * Snaps back to the base interval immediately when a change is detected.
 *
 * Much more cost-effective than SSE on Vercel:
 * - No persistent connections keeping functions alive
 * - Cached responses don't use CPU
 * - Only actual menu changes trigger fresh DB queries
 * - Adaptive polling reduces idle-time origin hits by 50-80%
 */
export function useMenuStream(
  menuUrl: string,
  initialMenu: Menu | null,
  options: UseMenuStreamOptions = {}
): UseMenuStreamResult {
  const { enabled = true, pollInterval = 2000 } = options

  const [menu, setMenu] = useState<Menu | null>(initialMenu)
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
    if (!menuUrl || !enabled) return

    try {
      const since = lastTimestampRef.current || ''
      const response = await fetch(`/api/menu-stream/${menuUrl}${since ? `?since=${since}` : ''}`, {
        cache: 'no-store', // Let the server handle caching
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data: MenuResponse = await response.json()

      // Detect new deployment and force a full page reload
      if (data.deployId) {
        if (deployIdRef.current === null) {
          deployIdRef.current = data.deployId
        } else if (data.deployId !== deployIdRef.current) {
          window.location.reload()
          return
        }
      }

      // Only update menu state when server indicates data has changed
      if (data.changed) {
        lastTimestampRef.current = data.timestamp
        setMenu(data.menu)
        noChangeCountRef.current = 0 // Snap back to fast polling
      } else if (data.warm) {
        // Editor is active — snap back to fast polling to catch upcoming changes
        noChangeCountRef.current = 0
      } else {
        noChangeCountRef.current += 1
      }

      // Always update theme state (component handles transitions)
      setThemeState(data.theme)

      setIsConnected(true)
      setError(null)
      setPollCount(prev => prev + 1)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch menu'))
      setIsConnected(false)
    }

    // Schedule next poll with adaptive interval
    if (enabled) {
      const nextInterval = getAdaptiveInterval(noChangeCountRef.current)
      pollTimeoutRef.current = setTimeout(poll, nextInterval)
    }
  }, [menuUrl, enabled, pollInterval, getAdaptiveInterval])

  // Start polling on mount
  useEffect(() => {
    if (enabled && menuUrl) {
      // Start polling immediately
      poll()
    }

    return () => {
      // Cleanup on unmount
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
        pollTimeoutRef.current = null
      }
    }
  }, [enabled, menuUrl, poll])

  // Update menu when initialMenu changes (server re-render)
  useEffect(() => {
    if (initialMenu) {
      setMenu(initialMenu)
    }
  }, [initialMenu])

  return { menu, theme, isConnected, error, pollCount }
}
