'use client'

import { useMemo } from 'react'
import { useMenuStream } from '@/lib/hooks/use-menu-stream'
import { FeaturedBeers, FeaturedCans } from '@/components/home/featured-menu'
import { NowPlaying } from '@/components/menu/now-playing'
import type { Menu } from '@/src/payload-types'
import { getThemeVars } from '@/lib/utils/display-theme'
import randomColor from 'randomcolor'

interface LiveMenuProps {
  menuUrl: string
  initialMenu: Menu
}

/**
 * Live-updating menu display component
 *
 * Uses polling against a cached endpoint for real-time updates.
 * - Polls every 2 seconds for near-instant updates
 * - Cache is invalidated on-demand when menu is updated in Payload
 * - Much more cost-effective than SSE on Vercel (no persistent connections)
 * - Applies dark mode via inline CSS variables for maximum browser compatibility
 */
export function LiveMenu({ menuUrl, initialMenu }: LiveMenuProps) {
  const { menu, theme, pollCount, nowPlaying } = useMenuStream(menuUrl, initialMenu, {
    enabled: true,
    pollInterval: 2000,
  })

  // Use streamed menu if available, otherwise fall back to initial
  const displayMenu = menu || initialMenu

  // Generate random light colors that cycle every ~30 seconds (dark mode only)
  const colorSeed = Math.floor(pollCount / 15)
  const itemColors = useMemo(() => {
    const itemCount = displayMenu.items?.length || 0
    if (itemCount === 0 || theme !== 'dark') return undefined

    // Generate colors with a slower-changing seed for smoother transitions
    return randomColor({
      count: itemCount,
      luminosity: 'light',
      seed: colorSeed,
    })
  }, [displayMenu.items?.length, theme, colorSeed])

  // Apply CSS variables directly - bypasses .dark class for browser compatibility
  const themeVars = getThemeVars(theme)

  const menuContent = displayMenu.type === 'cans'
    ? <FeaturedCans menu={displayMenu} animated itemColors={itemColors} />
    : <FeaturedBeers menu={displayMenu} animated itemColors={itemColors} />

  if (displayMenu.type === 'draft' || displayMenu.type === 'cans' || displayMenu.type === 'other') {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground" style={themeVars}>
        {menuContent}
        <NowPlaying nowPlaying={nowPlaying} />
      </div>
    )
  }

  return null
}
