/**
 * Shared line-cleaning cadence: days-since math and the warn/overdue
 * thresholds used by LinesCleanedAlert and MarkLinesCleanedButton, so the
 * cleaning schedule lives in exactly one place.
 */

export const LINES_WARN_DAYS = 7
export const LINES_OVERDUE_DAYS = 15

/** Whole days elapsed since an ISO date string, or null if unset/invalid. */
export function daysSinceCleaned(value: string | null | undefined): number | null {
  if (!value) return null
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return null
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24))
}
