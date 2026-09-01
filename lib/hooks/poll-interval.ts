/**
 * Pure interval selection for menu/event display polling.
 * Spec: docs/superpowers/specs/2026-09-01-vercel-efficiency-design.md
 */

export const FAST_INTERVAL_MS = 10_000
export const IDLE_INTERVAL_MS = 30_000
export const ERROR_BACKOFF_CAP_MS = 120_000

export interface PollIntervalInput {
  noChangeCount: number
  warm: boolean
  consecutiveErrors: number
  hidden: boolean
  /** True for the delay after the first successful poll. */
  isInitial?: boolean
}

export function selectPollInterval({
  noChangeCount,
  warm,
  consecutiveErrors,
  hidden,
  isInitial = false,
}: PollIntervalInput): number | null {
  if (hidden) return null
  if (consecutiveErrors >= 3) return ERROR_BACKOFF_CAP_MS
  if (consecutiveErrors === 2) return 60_000
  if (consecutiveErrors === 1) return 30_000
  if (warm || noChangeCount === 0 || isInitial) return FAST_INTERVAL_MS
  return IDLE_INTERVAL_MS
}
