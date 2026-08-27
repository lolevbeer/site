/**
 * Shared line-cleaning cadence: days-since math and the warn/overdue
 * thresholds, so the cleaning schedule lives in exactly one place. Read by the
 * admin surfaces (LinesCleanedAlert, MarkLinesCleanedButton) and by the
 * customer-facing /m draft displays (featured-menu.tsx) — it lives here rather
 * than under src/components/admin so nothing pulls admin code into the public
 * bundle.
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
