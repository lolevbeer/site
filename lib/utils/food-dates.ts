/**
 * Date maths for the recurring food schedule.
 *
 * Recurring food is configured as a "week of month + day of week" slot (e.g.
 * "2nd Tuesday") rather than as concrete dates, so both the server fetcher
 * (`lib/utils/payload-api.ts`) and the /food page expand those slots into real
 * dates. This module is deliberately free of Payload and Next imports so
 * either side can pull it in without dragging server-only code along.
 */

/**
 * Expand one "nth weekday of the month" slot across a calendar year.
 * Months without that occurrence (for example, a fifth Monday) are omitted.
 */
export function getDatesForSlotInYear(
  dayIndex: number,
  weekOccurrence: number,
  year: number,
): Date[] {
  const dates: Date[] = []

  for (let month = 0; month < 12; month++) {
    const firstDayOfMonth = new Date(year, month, 1).getDay()
    let firstOccurrence = dayIndex - firstDayOfMonth + 1
    if (firstOccurrence <= 0) firstOccurrence += 7

    const targetDay = firstOccurrence + (weekOccurrence - 1) * 7
    // Noon keeps the local calendar date stable when callers serialize it.
    const targetDate = new Date(year, month, targetDay, 12)

    if (targetDate.getMonth() === month) dates.push(targetDate)
  }

  return dates
}

/**
 * Calculate upcoming occurrences of a specific week/day combo.
 *
 * e.g. `getUpcomingDatesForSlot(2, 2, 6)` -> the next 2nd Tuesdays over the
 * coming 6 months. Months where the requested occurrence does not exist (a 5th
 * Friday, say) and occurrences already in the past are skipped, so the result
 * can be shorter than `monthsAhead`.
 *
 * Dates are built in the server's local time zone at midnight, matching the
 * `date.toISOString().split('T')[0]` keys the callers compare against.
 *
 * @param dayIndex Day of week, 0 = Sunday (matches `Date.getDay()`).
 * @param weekOccurrence 1-based occurrence within the month (1 = first).
 * @param monthsAhead How many months forward to scan, starting with the current one.
 */
export function getUpcomingDatesForSlot(
  dayIndex: number,
  weekOccurrence: number,
  monthsAhead: number = 6,
): Date[] {
  const dates: Date[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startMonth = today.getMonth()
  const startYear = today.getFullYear()

  for (let i = 0; i < monthsAhead; i++) {
    const month = (startMonth + i) % 12
    const year = startYear + Math.floor((startMonth + i) / 12)

    const firstOfMonth = new Date(year, month, 1)
    const firstDayOfMonth = firstOfMonth.getDay()

    let firstOccurrence = dayIndex - firstDayOfMonth + 1
    if (firstOccurrence <= 0) firstOccurrence += 7

    const targetDay = firstOccurrence + (weekOccurrence - 1) * 7
    const targetDate = new Date(year, month, targetDay)

    if (targetDate.getMonth() === month && targetDate >= today) {
      dates.push(targetDate)
    }
  }

  return dates
}
