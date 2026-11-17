/**
 * Date utilities: EST/EDT timezone helpers and elapsed-time checks.
 */

import { formatInTimeZone, fromZonedTime, toZonedTime, format } from 'date-fns-tz'

const EST_TIMEZONE = 'America/New_York'

export const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * True when `createdAt` is less than `windowMs` older than `now`, including any
 * time after `now`: the "Just Released" badge passes a clock floored to the
 * hour, so a beer created since the hour began is newer than `now`. Invalid
 * dates are not recent.
 */
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
 * Get the EST/EDT calendar date (YYYY-MM-DD) of an instant, such as a stored
 * timestamp. The date part of an ISO timestamp is the UTC day, which from 8pm
 * EDT (7pm EST) is already tomorrow.
 */
export function getDateEST(instant: Date | number): string {
  return format(toZonedTime(instant, EST_TIMEZONE), 'yyyy-MM-dd')
}

/**
 * Get today's date string in EST/EDT (YYYY-MM-DD format)
 */
export function getTodayEST(): string {
  return getDateEST(new Date())
}

/**
 * Convert a date string to EST/EDT Date object at noon. Uses the string's
 * YYYY-MM-DD part as written, so pass a timestamp through getDateEST first.
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
 * UTC ISO instant of local midnight starting a YYYY-MM-DD day in EST/EDT
 * (DST-aware), for Payload `date` range filters.
 */
export function getESTMidnightISO(date: string): string {
  return fromZonedTime(`${date}T00:00:00`, EST_TIMEZONE).toISOString()
}

/**
 * Get an ISO string representing the start of today in EST/EDT, converted to UTC.
 * Suitable for Payload CMS queries with `greater_than_equal`.
 */
export function getTodayMidnightISO(): string {
  return getESTMidnightISO(getTodayEST())
}

/**
 * Weekly opening and closing times are stored as instants on 1 January 2000
 * (a winter day, so no daylight saving), read back in the taproom's timezone.
 */
const WEEKLY_HOURS_DAY = '2000-01-01'

/** A stored weekly opening or closing time as "HH:mm" in `timezone`; "" when unset. */
export function clockFromStoredTime(stored: string | null | undefined, timezone: string): string {
  return stored ? formatInTimeZone(stored, timezone, 'HH:mm') : ''
}

/** "HH:mm" in `timezone` as the instant a weekly opening or closing time is stored as; null when blank. */
export function storedTimeFromClock(clock: string, timezone: string): string | null {
  return clock ? fromZonedTime(`${WEEKLY_HOURS_DAY}T${clock}:00`, timezone).toISOString() : null
}

/**
 * "HH:mm" as the Date Payload's time picker shows: that clock time in the
 * browser's own zone, on the weekly-hours reference day. Undefined when blank.
 */
export function pickerTimeFromClock(clock: string): Date | undefined {
  if (!clock) return undefined
  const [hours, minutes] = clock.split(':').map(Number)
  return new Date(2000, 0, 1, hours, minutes)
}

/** The clock time ("HH:mm") picked in Payload's time picker; "" when it was cleared. */
export function clockFromPickedTime(picked: Date | null | undefined): string {
  if (!picked) return ''
  return `${String(picked.getHours()).padStart(2, '0')}:${String(picked.getMinutes()).padStart(2, '0')}`
}
