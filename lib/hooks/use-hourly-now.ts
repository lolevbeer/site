/**
 * The current time, rounded down to the hour, for time-based UI such as the
 * "Just Released" badge.
 *
 * `null` while server rendering and hydrating, so server HTML and the first
 * client render always agree (no hydration mismatch when a beer crosses its
 * 7-day mark between the two, or a menu TV's clock is off). After that it is a
 * number that changes once an hour, which is what makes memoized cards on
 * long-running menu displays re-evaluate the badge. Built on
 * `useSyncExternalStore`, like `useIsHydrated`, rather than state set in an effect.
 */
'use client'

import { useSyncExternalStore } from 'react'

const HOUR_MS = 60 * 60 * 1000
/** How often to look for an hour change; the snapshot itself changes hourly. */
const CHECK_EVERY_MS = 60 * 1000

function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, CHECK_EVERY_MS)
  return () => clearInterval(id)
}

const getHour = () => Math.floor(Date.now() / HOUR_MS) * HOUR_MS
const getServerHour = () => null

export function useHourlyNow(): number | null {
  return useSyncExternalStore(subscribe, getHour, getServerHour)
}
