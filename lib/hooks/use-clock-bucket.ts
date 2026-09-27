/**
 * Which `periodMs` slice of wall-clock time it is: `Math.floor(Date.now() / periodMs)`,
 * re-rendering the caller when a new slice starts.
 *
 * For UI that must change with wall-clock time rather than with how often
 * anything polls or re-renders, such as a color cycle or an hourly badge
 * check. It is `null` while server rendering and hydrating, so server HTML and
 * the first client render always agree (the server can't know the viewer's
 * clock), and follows the clock after that. Built on `useSyncExternalStore`,
 * like `useIsHydrated`, rather than state set in an effect.
 */
'use client'

import { useCallback, useSyncExternalStore } from 'react'

const getServerBucket = () => null

export function useClockBucket(periodMs: number): number | null {
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
