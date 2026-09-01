/**
 * Wall-clock seed for live-display dark-mode color cycling.
 * Independent of poll interval so a 30s idle poll does not stretch the cycle.
 */

import { useEffect, useRef, useState } from 'react'

export const COLOR_CYCLE_MS = 30_000

export function colorCycleSeed(elapsedMs: number): number {
  return Math.floor(Math.max(0, elapsedMs) / COLOR_CYCLE_MS)
}

/** Advances about every 30s of elapsed wall-clock. Ticks immediately when the tab becomes visible. */
export function useColorCycleSeed(): number {
  const mountedAtRef = useRef(Date.now())
  const [seed, setSeed] = useState(0)

  useEffect(() => {
    const tick = () => setSeed(colorCycleSeed(Date.now() - mountedAtRef.current))
    tick()
    const id = window.setInterval(tick, COLOR_CYCLE_MS)
    const onVisibility = () => {
      if (!document.hidden) tick()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return seed
}
