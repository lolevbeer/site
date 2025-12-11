'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Menu } from '@/src/payload-types'

interface UseMenuPollingOptions {
  /** Polling interval in milliseconds (default: 30000 = 30 seconds) */
  interval?: number
  /** Whether polling is enabled (default: true) */
  enabled?: boolean
}

interface UseMenuPollingResult {
  menu: Menu | null
  isLoading: boolean
  error: Error | null
  /** Manually trigger a refresh */
  refresh: () => Promise<void>
}

/**
 * Hook for polling menu data with ETag support
 * Only fetches full data when menu has changed (304 Not Modified otherwise)
 */
export function useMenuPolling(
  menuUrl: string,
  initialMenu: Menu | null,
  options: UseMenuPollingOptions = {}
): UseMenuPollingResult {
  const { interval = 30000, enabled = true } = options

  const [menu, setMenu] = useState<Menu | null>(initialMenu)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Store ETag in a ref to persist across renders
  const etagRef = useRef<string | null>(null)

  const fetchMenu = useCallback(async () => {
    if (!menuUrl) return

    try {
      const headers: HeadersInit = {}

      // Include ETag for conditional request
      if (etagRef.current) {
        headers['If-None-Match'] = etagRef.current
      }

      const response = await fetch(`/api/menu-by-url/${menuUrl}`, { headers })

      // 304 Not Modified - content hasn't changed
      if (response.status === 304) {
        return
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch menu: ${response.status}`)
      }

      // Store new ETag
      const newEtag = response.headers.get('ETag')
      if (newEtag) {
        etagRef.current = newEtag
      }

      const data = await response.json()
      setMenu(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    }
  }, [menuUrl])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    await fetchMenu()
    setIsLoading(false)
  }, [fetchMenu])

  // Set up polling interval
  useEffect(() => {
    if (!enabled || !menuUrl) return

    // Initial fetch to get ETag
    fetchMenu()

    const intervalId = setInterval(fetchMenu, interval)

    return () => clearInterval(intervalId)
  }, [enabled, menuUrl, interval, fetchMenu])

  // Update menu when initialMenu changes (server re-render)
  useEffect(() => {
    if (initialMenu) {
      setMenu(initialMenu)
    }
  }, [initialMenu])

  return { menu, isLoading, error, refresh }
}
