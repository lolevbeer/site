/**
 * Which `periodMs` slice of wall-clock time it is: `Math.floor(Date.now() / periodMs)`,
 * re-rendering the caller when a new slice starts.
 *
 * Drives the menu and event displays' dark-mode color cycle, which must stay on
 * a fixed wall-clock rhythm however often (or seldom) the display polls. It is
 * 0 while server rendering and hydrating, so server HTML and the first client
 * render agree, and follows the clock after that. Built on
 * `useSyncExternalStore`, like `useIsHydrated`, rather than state set in an effect.
 */
'use client'

import { useCallback, useSyncExternalStore } from 'react'

const getServerBucket = () => 0

export function useClockBucket(periodMs: number): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      // Wake exactly when the next slice starts, then re-arm for the one after.
      let id: ReturnType<typeof setTimeout>
      const armForNextSlice = () => {
        id = setTimeout(
          () => {
            onChange()
            armForNextSlice()
          },
          periodMs - (Date.now() % periodMs),
        )
      }
      armForNextSlice()
      return () => clearTimeout(id)
    },
    [periodMs],
  )
  const getBucket = useCallback(() => Math.floor(Date.now() / periodMs), [periodMs])
  return useSyncExternalStore(subscribe, getBucket, getServerBucket)
}
