'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from 'next-themes'
import type { Menu } from '@/src/payload-types'

interface UseMenuStreamOptions {
  /** Whether streaming is enabled (default: true) */
  enabled?: boolean
  /** Poll interval in ms (default: 2000) */
  pollInterval?: number
}

interface UseMenuStreamResult {
  menu: Menu | null
  isConnected: boolean
  error: Error | null
}

interface MenuResponse {
  menu: Menu
  theme: 'light' | 'dark'
  timestamp: number
}

/**
 * Hook for real-time menu updates via polling
 *
 * Uses polling against a cached endpoint for cost-effective updates.
 * The endpoint serves cached data (nearly free) until cache is invalidated
 * by Payload's afterChange hook when a menu is actually updated.
 *
 * Much more cost-effective than SSE on Vercel:
 * - No persistent connections keeping functions alive
 * - Cached responses don't use CPU
 * - Only actual menu changes trigger fresh DB queries
 */
export function useMenuStream(
  menuUrl: string,
  initialMenu: Menu | null,
  options: UseMenuStreamOptions = {}
): UseMenuStreamResult {
  const { enabled = true, pollInterval = 2000 } = options
  const { setTheme } = useTheme()

  const [menu, setMenu] = useState<Menu | null>(initialMenu)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTimestampRef = useRef<number>(0)
  const lastThemeRef = useRef<string | null>(null)

  const poll = useCallback(async () => {
    if (!menuUrl || !enabled) return

    try {
      const response = await fetch(`/api/menu-stream/${menuUrl}`, {
        cache: 'no-store', // Let the server handle caching
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data: MenuResponse = await response.json()

      // Only update if data has changed
      if (data.timestamp !== lastTimestampRef.current) {
        lastTimestampRef.current = data.timestamp
        setMenu(data.menu)
      }

      // Apply theme only if it changed (separate from timestamp to avoid flicker)
      if (data.theme !== lastThemeRef.current) {
        lastThemeRef.current = data.theme
        // Use next-themes setTheme to keep state in sync
        setTheme(data.theme)
      }

      setIsConnected(true)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch menu'))
      setIsConnected(false)
    }

    // Schedule next poll
    if (enabled) {
      pollTimeoutRef.current = setTimeout(poll, pollInterval)
    }
  }, [menuUrl, enabled, pollInterval, setTheme])

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

  return { menu, isConnected, error }
}
