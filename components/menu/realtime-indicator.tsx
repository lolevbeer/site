'use client'

/**
 * Small lightning bolt in the bottom-right corner of a menu board, shown while
 * the display is connected to Ably. It rests dim and flashes each time a push
 * arrives, so a CMS save is visibly seen reaching the TV.
 *
 * Sits in the gutter outside the board's safe-area padding (see tv-display.ts),
 * sized in vh like the rest of the board so it scales with the frame.
 */

import { Zap } from '@/components/icons'

interface RealtimeIndicatorProps {
  /** True while the Ably connection is up. */
  connected: boolean
  /** Changes on every push; re-keying the icon restarts the CSS pulse. */
  pulseKey: number
}

export function RealtimeIndicator({ connected, pulseKey }: RealtimeIndicatorProps) {
  if (!connected) return null

  return (
    <div
      role="img"
      aria-label="Live updates connected"
      className="pointer-events-none fixed text-foreground"
      style={{ right: '1vh', bottom: '0.7vh', width: '2vh', height: '2vh' }}
    >
      <Zap key={pulseKey} className="live-pulse size-full" />
    </div>
  )
}
