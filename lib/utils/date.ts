/**
 * Date utilities: EST/EDT timezone helpers and elapsed-time checks.
 */

import { toZonedTime, format } from 'date-fns-tz'

const EST_TIMEZONE = 'America/New_York'

export const MS_PER_DAY = 24 * 60 * 60 * 1000

/** True when `createdAt` is inside `windowMs` before `now`. Invalid dates are not recent. */
export function isRecentTimestamp(
  createdAt: string | undefined,
  windowMs: number,
  now = Date.now(),
): boolean {
  if (!createdAt) return false
  const then = new Date(createdAt).getTime()
  return Number.isFinite(then) && now - then < windowMs
}

/**
 * Get current date and time in EST/EDT timezone
 */
export function getCurrentESTDateTime(): Date {
  return toZonedTime(new Date(), EST_TIMEZONE)
}

/**
 * Get today's date string in EST/EDT (YYYY-MM-DD format)
 */
export function getTodayEST(): string {
  return format(getCurrentESTDateTime(), 'yyyy-MM-dd')
}

/**
 * Convert a date string to EST/EDT Date object at noon
 */
export function toESTDate(dateString: string): Date {
  return new Date(`${dateString.split('T')[0]}T12:00:00-05:00`)
}

/**
 * Get day of week name for a date string in EST/EDT
 */
export function getDayOfWeekEST(dateString: string): string {
  return format(toESTDate(dateString), 'EEEE')
}

/**
 * Get an ISO string representing the start of today in EST/EDT, converted to UTC.
 * Suitable for Payload CMS queries with `greater_than_equal`.
 */
export function getTodayMidnightISO(): string {
  return new Date(`${getTodayEST()}T00:00:00-05:00`).toISOString()
}
