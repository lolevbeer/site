'use client'

import { useEffect } from 'react'
import { useMenuStream } from '@/lib/hooks/use-menu-stream'
import { FeaturedBeers, FeaturedCans } from '@/components/home/featured-menu'
import type { Menu } from '@/src/payload-types'

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
 * - Applies dark mode directly via class on container (bypasses next-themes for reliability)
 */
export function LiveMenu({ menuUrl, initialMenu }: LiveMenuProps) {
  const { menu, theme } = useMenuStream(menuUrl, initialMenu, {
    enabled: true,
    pollInterval: 2000,
  })

  // Use streamed menu if available, otherwise fall back to initial
  const displayMenu = menu || initialMenu

  // Apply dark class to html element directly for proper CSS variable inheritance
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  if (displayMenu.type === 'draft') {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col">
        <FeaturedBeers menu={displayMenu} animated />
      </div>
    )
  }

  if (displayMenu.type === 'cans') {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col">
        <FeaturedCans menu={displayMenu} animated />
      </div>
    )
  }

  // 'other' type renders like draft
  if (displayMenu.type === 'other') {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col">
        <FeaturedBeers menu={displayMenu} animated />
      </div>
    )
  }

  return null
}
