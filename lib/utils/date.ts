/**
 * Date utilities for handling EST/EDT timezone
 */

import { toZonedTime, format } from 'date-fns-tz';

const EST_TIMEZONE = 'America/New_York';

/**
 * Get current date and time in EST/EDT timezone
 */
export function getCurrentESTDateTime(): Date {
  return toZonedTime(new Date(), EST_TIMEZONE);
}

/**
 * Get today's date string in EST/EDT (YYYY-MM-DD format)
 */
export function getTodayEST(): string {
  return format(getCurrentESTDateTime(), 'yyyy-MM-dd');
}

/**
 * Convert a date string to EST/EDT Date object at noon
 */
export function toESTDate(dateString: string): Date {
  return new Date(`${dateString.split('T')[0]}T12:00:00-05:00`);
}

/**
 * Check if a date string is today in EST/EDT
 */
export function isTodayEST(dateString: string): boolean {
  return dateString.split('T')[0] === getTodayEST();
}

/**
 * Check if a date string is in the future (including today) in EST/EDT
 */
export function isFutureOrTodayEST(dateString: string): boolean {
  return dateString.split('T')[0] >= getTodayEST();
}

/**
 * Get day of week name for a date string in EST/EDT
 */
export function getDayOfWeekEST(dateString: string): string {
  return format(toESTDate(dateString), 'EEEE');
}

/**
 * Format date for display in EST/EDT
 */
export function formatDateEST(dateString: string): string {
  return format(toESTDate(dateString), 'EEEE, MMMM d, yyyy');
}

/**
 * Get an ISO string representing the start of today in EST/EDT, converted to UTC.
 * Suitable for Payload CMS queries with `greater_than_equal`.
 */
export function getTodayMidnightISO(): string {
  return new Date(`${getTodayEST()}T00:00:00-05:00`).toISOString();
}

