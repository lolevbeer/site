'use client'

import { useMemo } from 'react'

import { useAblyInvalidate } from './use-ably-invalidate'
import { usePolling } from './use-polling'
import { getPittsburghTheme } from '@/lib/utils/pittsburgh-time'
import type { Menu } from '@/src/payload-types'

interface UseMenuStreamResult {
  menu: Menu | null
  theme: 'light' | 'dark'
  /** True while the display is connected to Ably (drives the corner bolt). */
  realtime: boolean
  /** Pushes received for this menu so far; changes on each one (drives the pulse). */
  pushCount: number
}

/** Shape of the /api/menu-stream response */
interface MenuResponse {
  menu: Menu
  timestamp: number
  deployId?: string
}

/**
 * Hook for real-time menu updates via adaptive polling, with an optional
 * Ably invalidate path (NEXT_PUBLIC_ABLY_ENABLED) that forces an immediate
 * poll when CMS revalidation publishes to kiosk:menu.
 *
 * Wraps the generic usePolling hook with menu-specific data transformation.
 * The display theme is the menu's fixed themeMode, or Pittsburgh day/night for
 * "auto", worked out here because the cached response carries no clock.
 * See usePolling for details on adaptive interval behavior and CDN caching.
 */
export function useMenuStream(menuUrl: string, initialMenu: Menu | null): UseMenuStreamResult {
  const stableInitialMenu = useMemo(() => initialMenu, [initialMenu])
  const { invalidateSignal, realtimeActive } = useAblyInvalidate({
    kind: 'menu',
    key: menuUrl,
  })

  const streamUrl = menuUrl ? `/api/menu-stream/${menuUrl}` : ''

  const { data: menu, theme } = usePolling<Menu, MenuResponse>(
    streamUrl,
    stableInitialMenu,
    ({ menu: responseMenu }) => ({
      data: responseMenu,
      theme:
        responseMenu.themeMode && responseMenu.themeMode !== 'auto'
          ? responseMenu.themeMode
          : getPittsburghTheme(),
    }),
    {
      clearOnNotFound: true,
      invalidateSignal,
      realtimeFallback: realtimeActive,
      invalidateUrl: streamUrl ? `${streamUrl}/fresh` : undefined,
    },
  )

  return { menu, theme, realtime: realtimeActive, pushCount: invalidateSignal }
}
