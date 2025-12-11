'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Menu } from '@/src/payload-types'

interface UseMenuStreamOptions {
  /** Whether streaming is enabled (default: true) */
  enabled?: boolean
  /** Reconnect delay in ms after disconnect (default: 1000) */
  reconnectDelay?: number
}

interface UseMenuStreamResult {
  menu: Menu | null
  isConnected: boolean
  error: Error | null
}

/**
 * Hook for real-time menu updates via Server-Sent Events
 *
 * Uses SSE to receive push updates from the server.
 * Auto-reconnects when connection drops (Vercel has 30s timeout).
 * Much more efficient than polling for many displays.
 */
export function useMenuStream(
  menuUrl: string,
  initialMenu: Menu | null,
  options: UseMenuStreamOptions = {}
): UseMenuStreamResult {
  const { enabled = true, reconnectDelay = 1000 } = options

  const [menu, setMenu] = useState<Menu | null>(initialMenu)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (!menuUrl || !enabled) return

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    try {
      const es = new EventSource(`/api/menu-stream/${menuUrl}`)
      eventSourceRef.current = es

      es.onopen = () => {
        setIsConnected(true)
        setError(null)
      }

      es.addEventListener('menu', (event) => {
        try {
          const data = JSON.parse(event.data) as Menu
          setMenu(data)
        } catch (err) {
          console.error('Failed to parse menu data:', err)
        }
      })

      es.addEventListener('error', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data)
          setError(new Error(data.error || 'Stream error'))
        } catch {
          // Not a JSON error event, likely connection issue
        }
      })

      es.onerror = () => {
        setIsConnected(false)
        es.close()

        // Auto-reconnect after delay
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, reconnectDelay)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to connect'))
      setIsConnected(false)

      // Retry connection
      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, reconnectDelay)
    }
  }, [menuUrl, enabled, reconnectDelay])

  // Connect on mount and when dependencies change
  useEffect(() => {
    if (enabled) {
      connect()
    }

    return () => {
      // Cleanup on unmount
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [connect, enabled])

  // Update menu when initialMenu changes (server re-render)
  useEffect(() => {
    if (initialMenu) {
      setMenu(initialMenu)
    }
  }, [initialMenu])

  return { menu, isConnected, error }
}
