/**
 * Shared line-cleaning cadence: days-since math and the warn/overdue
 * thresholds, plus the warning/error level the admin alerts show, so the
 * cleaning schedule lives in exactly one place. Read by the admin surfaces
 * (MarkLinesCleanedButton and the dashboard's needs-attention rows) and by the
 * customer-facing /m draft displays (featured-menu.tsx) — it lives here rather
 * than under src/components/admin so nothing pulls admin code into the public
 * bundle.
 */

import { MS_PER_DAY } from '@/lib/utils/date'

export const LINES_WARN_DAYS = 7
export const LINES_OVERDUE_DAYS = 15

/** Whole days elapsed since an ISO date string, or null if unset/invalid. */
export function daysSinceCleaned(
  value: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!value) return null
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return null
  return Math.floor((now - timestamp) / MS_PER_DAY)
}

export type LinesCleanedLevel = {
  /** 'error' when overdue or never cleaned, 'warning' inside the warn window, else null. */
  level: 'warning' | 'error' | null
  /** Days since cleaned; -1 when never cleaned. */
  days: number
  /** The overdue date as 'Nov 5' (New York), or null when never cleaned. */
  dueDate: string | null
}

/** How urgently a location's draft lines need cleaning, as of `now`. */
export function linesCleanedLevel(
  value: string | null | undefined,
  now: number = Date.now(),
): LinesCleanedLevel {
  const days = daysSinceCleaned(value, now)
  if (!value || days === null) return { level: 'error', days: -1, dueDate: null }

  const dueDate = new Date(Date.parse(value) + LINES_OVERDUE_DAYS * MS_PER_DAY).toLocaleDateString(
    'en-US',
    { month: 'short', day: 'numeric', timeZone: 'America/New_York' },
  )
  if (days >= LINES_OVERDUE_DAYS) return { level: 'error', days, dueDate }
  if (days >= LINES_WARN_DAYS) return { level: 'warning', days, dueDate }
  return { level: null, days, dueDate }
}
