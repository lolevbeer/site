/**
 * Date utilities for handling EST/EDT timezone
 */

/**
 * Get current date in EST/EDT timezone
 */
export function getESTDate(): Date {
  const now = new Date();
  // Get the components in EST/EDT timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "America/New_York",
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);

  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0');
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');

  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * Get today's date string in EST/EDT (YYYY-MM-DD format)
 */
export function getTodayEST(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "America/New_York",
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);

  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';

  return `${year}-${month}-${day}`;
}

/**
 * Convert a date string to EST/EDT Date object
 * IMPORTANT: Treat the date string as already being in EST/EDT
 */
export function toESTDate(dateString: string): Date {
  // Parse the date string components
  const [year, month, day] = dateString.split('-').map(Number);

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
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'America/New_York'
  });
}

/**
 * Format date for display in EST/EDT
 */
export function formatDateEST(dateString: string): string {
  const date = toESTDate(dateString.split('T')[0]);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York'
  });
}