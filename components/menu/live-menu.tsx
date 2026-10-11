'use client'

import { useMemo } from 'react'
import { useMenuStream } from '@/lib/hooks/use-menu-stream'
import { useClockBucket } from '@/lib/hooks/use-clock-bucket'
import { FeaturedBeers, FeaturedCans } from '@/components/home/featured-menu'
import { RealtimeIndicator } from '@/components/menu/realtime-indicator'
import { TapListBanner } from '@/components/ui/tap-list-banner'
import type { Menu } from '@/src/payload-types'
import { getThemeVars } from '@/lib/utils/display-theme'
import { seededLightColors } from '@/lib/utils/seeded-colors'

interface LiveMenuProps {
  menuUrl: string
  initialMenu: Menu
}

/**
 * Live-updating menu display component
 *
 * Uses polling against a cached endpoint for real-time updates, with an
 * optional Ably invalidate path (NEXT_PUBLIC_ABLY_ENABLED) that forces an
 * immediate poll on CMS edits.
 * - Polls every 10s after a change and every 30s when idle, not while the tab
 *   is hidden (see usePolling); 120s safety-net while Ably is connected
 * - The endpoint is CDN-cached and invalidated when the menu or a beer on it
 *   is edited in Payload, so an edit shows within about a minute (faster with Ably)
 * - Much more cost-effective than SSE on Vercel (no persistent app-server connections)
 * - Applies dark mode via inline CSS variables for maximum browser compatibility
 * - Shows a small lightning bolt in the corner while connected to Ably, pulsing
 *   when a push arrives (see RealtimeIndicator)
 * - On portrait screens (phones), adds a link to the taproom page (TapListBanner)
 */
export function LiveMenu({ menuUrl, initialMenu }: LiveMenuProps) {
  const { menu, theme, realtime, pushCount } = useMenuStream(menuUrl, initialMenu)

  const displayMenu = menu

  // Deterministic light colors that change every 30s of wall-clock time,
  // however often the display polls (dark mode only). Seed 0 until hydrated.
  const colorSeed = useClockBucket(30_000) ?? 0
  const itemColors = useMemo(() => {
    const itemCount = displayMenu?.items?.length || 0
    if (itemCount === 0 || theme !== 'dark') return undefined

    return seededLightColors(itemCount, colorSeed)
  }, [displayMenu?.items?.length, theme, colorSeed])

  // Apply CSS variables directly - bypasses .dark class for browser compatibility
  const themeVars = getThemeVars(theme)

  if (!displayMenu) return null

  // 'other' type renders like draft
  const board =
    displayMenu.type === 'cans' ? (
      <FeaturedCans
        menu={displayMenu}
        animated
        itemColors={itemColors}
        labelVideos={displayMenu.animateCans ?? true}
      />
    ) : displayMenu.type === 'draft' || displayMenu.type === 'other' ? (
      <FeaturedBeers menu={displayMenu} animated itemColors={itemColors} />
    ) : null

  if (!board) return null

  const location = displayMenu.location
  const locationSlug = typeof location === 'object' ? location?.slug : undefined

  return (
    <div
      className="h-dvh w-screen overflow-hidden flex flex-col bg-background text-foreground"
      style={themeVars}
    >
      {/* flex-1 box so the h-full board shrinks to make room for the portrait banner. */}
      <div className="flex-1 min-h-0">{board}</div>
      {locationSlug ? <TapListBanner locationSlug={locationSlug} /> : null}
      <RealtimeIndicator connected={realtime} pulseKey={pushCount} />
    </div>
  )
}
