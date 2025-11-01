/**
 * Date utilities for handling EST/EDT timezone
 */

import { toZonedTime, format } from 'date-fns-tz';

const EST_TIMEZONE = 'America/New_York';

/**
 * Get current date in EST/EDT timezone
 */
export function getESTDate(): Date {
  const now = new Date();
  const estDate = toZonedTime(now, EST_TIMEZONE);
  estDate.setHours(12, 0, 0, 0);
  return estDate;
}

/**
 * Get today's date string in EST/EDT (YYYY-MM-DD format)
 */
export function getTodayEST(): string {
  return format(toZonedTime(new Date(), EST_TIMEZONE), 'yyyy-MM-dd', { timeZone: EST_TIMEZONE });
}

/**
 * Convert a date string to EST/EDT Date object
 * IMPORTANT: Treat the date string as already being in EST/EDT
 */
export function toESTDate(dateString: string): Date {
  // Create date at noon EST to avoid timezone edge cases
  // We use a specific time string to ensure it's interpreted as EST
  const dateAtNoonEST = new Date(`${dateString}T12:00:00-05:00`);

  return dateAtNoonEST;
}

/**
 * Check if a date string is today in EST/EDT
 */
export function isTodayEST(dateString: string): boolean {
  const today = getTodayEST();
  return dateString.split('T')[0] === today;
}

/**
 * Check if a date string is in the future (including today) in EST/EDT
 */
export function isFutureOrTodayEST(dateString: string): boolean {
  const today = getTodayEST();
  const dateOnly = dateString.split('T')[0];
  return dateOnly >= today;
}

/**
 * Get day of week name for a date string in EST/EDT
 */
export function getDayOfWeekEST(dateString: string): string {
  const date = toESTDate(dateString.split('T')[0]);
  return format(date, 'EEEE', { timeZone: EST_TIMEZONE });
}

/**
 * Format date for display in EST/EDT
 */
export function formatDateEST(dateString: string): string {
  const date = toESTDate(dateString.split('T')[0]);
  return format(date, 'EEEE, MMMM d, yyyy', { timeZone: EST_TIMEZONE });
}

/**
 * Compare two date strings in YYYY-MM-DD format
 * Returns negative if a < b, positive if a > b, 0 if equal
 */
export function compareDateStrings(a: string, b: string): number {
  const [yearA, monthA, dayA] = a.split('-').map(Number);
  const [yearB, monthB, dayB] = b.split('-').map(Number);
  const dateA = new Date(yearA, monthA - 1, dayA);
  const dateB = new Date(yearB, monthB - 1, dayB);
  return dateA.getTime() - dateB.getTime();
}