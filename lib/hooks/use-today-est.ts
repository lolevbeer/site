/**
 * Today's America/New_York date (YYYY-MM-DD) as the viewer's clock sees it,
 * or `null` while server rendering and hydrating.
 *
 * ISR pages are rendered once and served for hours, so a "today" computed on
 * the server goes stale at midnight and highlights yesterday. Callers render
 * no "today" styling (and drop no past rows) for `null`, so server HTML and
 * the first client render agree and hydration never mismatches; they apply it
 * once this returns a date.
 *
 * Every caller shares one minute timer (a footer alone has 7 hours rows per
 * taproom), and components re-render only when the date changes, so an open
 * page rolls over at midnight.
 */
'use client'

import { useSyncExternalStore } from 'react'
import { getTodayEST } from '@/lib/utils/date'

const MINUTE_MS = 60_000
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined

/** Wake on each minute boundary and let every subscriber re-read the date. */
function arm() {
  timer = setTimeout(
    () => {
      listeners.forEach((onChange) => onChange())
      arm()
    },
    MINUTE_MS - (Date.now() % MINUTE_MS),
  )
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  if (listeners.size === 1) arm()
  return () => {
    listeners.delete(onChange)
    if (listeners.size === 0) clearTimeout(timer)
  }
}

const getServerToday = () => null

export function useTodayEST(): string | null {
  return useSyncExternalStore(subscribe, getTodayEST, getServerToday)
}
