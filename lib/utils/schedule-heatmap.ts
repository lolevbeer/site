/**
 * Pure helpers for the admin schedule heatmap widget (server data + client
 * grid). Days are YYYY-MM-DD strings in EST (America/New_York).
 */
import { getDatesForSlotInYear, toDateKey } from './food-dates'

export const WEEKS = 70 // ~16 months per window
export const PAGES_BACK = 3 // ~4 years of history
export const PAGES_AHEAD = 1

/** What a day has booked; drives the cell color. */
export type DayKind = 'none' | 'event' | 'food' | 'both'

/**
 * One booking on one EST day, as sent from the server to the client grid.
 * `vendor` is the food vendor id (food identity, as on the public site);
 * `recurring` marks rows expanded from a rule rather than a stored document.
 */
export type ScheduleRow = {
  day: string
  kind: 'event' | 'food'
  name: string
  location: string
  vendor?: string
  recurring?: true
}

/**
 * Drop repeat bookings, keeping the first (pass one-offs before recurring
 * rows): a one-off can confirm a recurring slot. Food matches on location +
 * day + vendor id, like the public /food page; events on location + day +
 * organizer, like mergeScheduledEvents, but by EST day.
 */
export function dedupeSchedule(rows: ScheduleRow[]): ScheduleRow[] {
  const seen = new Set<string>()
  return rows.filter((r) => {
    const who = r.kind === 'food' && r.vendor ? r.vendor : r.name.trim().toLowerCase()
    const key = `${r.kind}|${r.location}|${r.day}|${who}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Short month name of a YYYY-MM-DD date. */
export const monthName = (date: string) => MONTHS[Number(date.slice(5, 7)) - 1]

/** 0 = Sunday for a YYYY-MM-DD date; noon UTC keeps DST out of the math. */
export const dayOfWeek = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay()

/** Shift a YYYY-MM-DD date by whole days. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** `weeks` Sunday-first columns of 7 dates, starting on `firstSunday`. */
export function buildHeatmapWeeks(firstSunday: string, weeks: number): string[][] {
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(firstSunday, w * 7 + d)),
  )
}

/**
 * Dates in [from, through] matching an nth-weekday slot (e.g. 2nd Tuesday)
 * within `year` only. Recurring rules are set up per year, so a 2026 rule
 * never spills into 2027 cells.
 */
export function slotDatesInRange(
  dayIndex: number,
  weekOccurrence: number,
  year: number,
  from: string,
  through: string,
): string[] {
  return getDatesForSlotInYear(dayIndex, weekOccurrence, year)
    .map(toDateKey)
    .filter((key) => key >= from && key <= through)
}

/**
 * Month header for the week columns: consecutive columns grouped by the month
 * their Saturday falls in, so each label spans the width its weeks take up.
 */
export function monthSpans(weeks: string[][]): { label: string; span: number }[] {
  const spans: { label: string; span: number }[] = []
  for (const week of weeks) {
    const label = monthName(week[6])
    const last = spans.at(-1)
    if (last?.label === label) last.span++
    else spans.push({ label, span: 1 })
  }
  return spans
}
