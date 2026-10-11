/**
 * Today's America/New_York date (YYYY-MM-DD) as the viewer's clock sees it,
 * or `null` while server rendering and hydrating.
 *
 * ISR pages are rendered once and served for hours, so a "today" computed on
 * the server goes stale at midnight and highlights yesterday. Callers render
 * no "today" styling for `null` (server HTML and the first client render
 * agree, so no hydration mismatch) and apply it once this returns a date.
 * Re-checks every minute via `useClockBucket`, so an open page rolls over.
 */
'use client'

import { useClockBucket } from '@/lib/hooks/use-clock-bucket'
import { getTodayEST } from '@/lib/utils/date'

export function useTodayEST(): string | null {
  const minute = useClockBucket(60_000)
  return minute === null ? null : getTodayEST()
}
