'use client'

import { useMemo, useState, useCallback } from 'react'

import { usePolling, type UsePollingOptions } from './use-polling'
import type { Menu } from '@/src/payload-types'
import type { NowPlaying } from '@/lib/utils/spotify'

interface UseMenuStreamResult {
  menu: Menu | null
  theme: 'light' | 'dark'
  isConnected: boolean
  error: Error | null
  /** Increments on each successful poll - useful for cycling effects */
  pollCount: number
  /** Currently playing Spotify track, if any */
  nowPlaying: NowPlaying | null
}

/** Shape of the /api/menu-stream response */
interface MenuResponse {
  menu: Menu
  theme: 'light' | 'dark'
  timestamp: number
  deployId?: string
  warm?: boolean
  nowPlaying?: NowPlaying | null
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
  options: UsePollingOptions = {},
): UseMenuStreamResult {
  const stableInitialMenu = useMemo(() => initialMenu, [initialMenu])
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null)

  const applyResponse = useCallback(({ menu: responseMenu, theme: responseTheme, nowPlaying: np }: MenuResponse) => {
    setNowPlaying(prev => {
      const next = np ?? null
      if (prev?.trackName === next?.trackName && prev?.artistName === next?.artistName && prev?.isPlaying === next?.isPlaying) {
        return prev
      }
      return next
    })
    return { data: responseMenu, theme: responseTheme }
  }, [])

  const { data: menu, theme, isConnected, error, pollCount } = usePolling<Menu, MenuResponse>(
    menuUrl ? `/api/menu-stream/${menuUrl}` : '',
    stableInitialMenu,
    applyResponse,
    options,
  )

  return { menu, theme, isConnected, error, pollCount, nowPlaying }
}
