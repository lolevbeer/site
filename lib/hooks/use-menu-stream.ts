'use client'

import { usePolling } from './use-polling'
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

interface MenuResponse {
  menu: Menu
  theme: 'light' | 'dark'
  timestamp: number
  deployId?: string
  warm?: boolean
}

/**
 * Hook for real-time menu updates via adaptive polling.
 *
 * Wraps the generic usePolling hook with menu-specific data transformation.
 * See usePolling for details on adaptive interval behavior, warm-up signals,
 * and cost-effective CDN caching strategy.
 */
export function useMenuStream(
  menuUrl: string,
  initialMenu: Menu | null,
  options: UseMenuStreamOptions = {}
): UseMenuStreamResult {
  const { data: menu, theme, isConnected, error, pollCount } = usePolling<Menu, MenuResponse>(
    menuUrl ? `/api/menu-stream/${menuUrl}` : '',
    initialMenu,
    (response) => ({ data: response.menu, theme: response.theme }),
    options
  )

  return { menu, theme, isConnected, error, pollCount }
}
