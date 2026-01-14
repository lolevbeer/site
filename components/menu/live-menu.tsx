'use client'

import { useMemo } from 'react'
import { useMenuStream } from '@/lib/hooks/use-menu-stream'
import { FeaturedBeers, FeaturedCans } from '@/components/home/featured-menu'
import type { Menu } from '@/src/payload-types'
import randomColor from 'randomcolor'

interface LiveMenuProps {
  menuUrl: string
  initialMenu: Menu
}

// Light mode CSS variables
const lightVars = {
  '--color-background': '#ffffff',
  '--color-foreground': '#1d1d1f',
  '--color-foreground-muted': '#6e6e73',
  '--color-card': '#ffffff',
  '--color-card-foreground': '#1d1d1f',
  '--color-primary': '#1d1d1f',
  '--color-primary-foreground': '#ffffff',
  '--color-secondary': '#f5f5f7',
  '--color-secondary-foreground': '#1d1d1f',
  '--color-muted': 'oklch(95.5% 0 0)',
  '--color-muted-foreground': '#86868b',
  '--color-border': '#d2d2d7',
} as React.CSSProperties

// Dark mode CSS variables
const darkVars = {
  '--color-background': '#000000',
  '--color-foreground': '#f5f5f7',
  '--color-foreground-muted': '#acacae',
  '--color-card': '#1d1d1f',
  '--color-card-foreground': '#f5f5f7',
  '--color-primary': '#ffffff',
  '--color-primary-foreground': '#000000',
  '--color-secondary': '#2c2c2e',
  '--color-secondary-foreground': '#f5f5f7',
  '--color-muted': '#2c2c2e',
  '--color-muted-foreground': '#98989d',
  '--color-border': '#38383a',
} as React.CSSProperties

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
  const { menu, theme, pollCount } = useMenuStream(menuUrl, initialMenu, {
    enabled: true,
    pollInterval: 2000,
  })

  // Use streamed menu if available, otherwise fall back to initial
  const displayMenu = menu || initialMenu

  // Generate random light colors that cycle on each poll (dark mode only)
  const itemColors = useMemo(() => {
    const itemCount = displayMenu.items?.length || 0
    if (itemCount === 0 || theme !== 'dark') return undefined

    // Generate colors with pollCount as part of the seed for variety
    return randomColor({
      count: itemCount,
      luminosity: 'light',
      seed: pollCount,
    })
  }, [displayMenu.items?.length, theme, pollCount])

  // Apply CSS variables directly - bypasses .dark class for browser compatibility
  const themeVars = theme === 'dark' ? darkVars : lightVars

  if (displayMenu.type === 'draft') {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground" style={themeVars}>
        <FeaturedBeers menu={displayMenu} animated itemColors={itemColors} />
      </div>
    )
  }

  if (displayMenu.type === 'cans') {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground" style={themeVars}>
        <FeaturedCans menu={displayMenu} animated itemColors={itemColors} />
      </div>
    )
  }

  // 'other' type renders like draft
  if (displayMenu.type === 'other') {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground" style={themeVars}>
        <FeaturedBeers menu={displayMenu} animated itemColors={itemColors} />
      </div>
    )
  }

  return null
}
