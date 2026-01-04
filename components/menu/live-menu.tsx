'use client'

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
 * Uses Server-Sent Events (SSE) for real-time updates.
 * - Single persistent connection per display
 * - Updates within 5 seconds of Payload changes
 * - Auto-reconnects if connection drops
 * - Much more efficient than polling for many displays
 */
export function LiveMenu({ menuUrl, initialMenu }: LiveMenuProps) {
  const { menu } = useMenuStream(menuUrl, initialMenu, {
    enabled: true,
    reconnectDelay: 1000,
  })

  // Use streamed menu if available, otherwise fall back to initial
  const displayMenu = menu || initialMenu

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
