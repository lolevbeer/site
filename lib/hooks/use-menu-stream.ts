'use client'

import { useMemo } from 'react'

import { usePolling, type UsePollingOptions } from './use-polling'
import { getPittsburghTheme } from '@/lib/utils/pittsburgh-time'
import type { Menu } from '@/src/payload-types'

interface UseMenuStreamResult {
  menu: Menu | null
  theme: 'light' | 'dark'
  isConnected: boolean
  error: Error | null
  /** Increments on each successful poll - useful for cycling effects */
  pollCount: number
}

/** Shape of the /api/menu-stream response */
interface MenuResponse {
  menu: Menu
  timestamp: number
  deployId?: string
}

/**
 * Hook for real-time menu updates via adaptive polling.
 *
 * Wraps the generic usePolling hook with menu-specific data transformation.
 * The display theme is the menu's fixed themeMode, or Pittsburgh day/night for
 * "auto", worked out here because the cached response carries no clock.
 * See usePolling for details on adaptive interval behavior and CDN caching.
 */
export function useMenuStream(
  menuUrl: string,
  initialMenu: Menu | null,
  options: UsePollingOptions = {},
): UseMenuStreamResult {
  const stableInitialMenu = useMemo(() => initialMenu, [initialMenu])

  const { data: menu, theme, isConnected, error, pollCount } = usePolling<Menu, MenuResponse>(
    menuUrl ? `/api/menu-stream/${menuUrl}` : '',
    stableInitialMenu,
    ({ menu: responseMenu }) => ({
      data: responseMenu,
      theme:
        responseMenu.themeMode && responseMenu.themeMode !== 'auto'
          ? responseMenu.themeMode
          : getPittsburghTheme(),
    }),
    options,
  )

  return { menu, theme, isConnected, error, pollCount }
}
