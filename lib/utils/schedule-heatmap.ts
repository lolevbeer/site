/**
 * Pure helpers for the admin schedule heatmap widget (server data + client
 * grid). Days are YYYY-MM-DD strings in EST (America/New_York).
 */
import type { RecurringFoodState } from '@/src/utils/recurring-food'
import { recurringDays, recurringOccurrences } from '@/src/utils/recurring-food'
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

/** Every calendar year in [from, through]; recurring rules are set up per year. */
export function scheduleYears(from: string, through: string): number[] {
  const first = Number(from.slice(0, 4))
  return Array.from({ length: Number(through.slice(0, 4)) - first + 1 }, (_, i) => first + i)
}

/** Vendor ids held by recurring food slots, for one batched name lookup. */
export function recurringFoodVendorIds(states: RecurringFoodState[]): string[] {
  const ids = new Set<string>()
  for (const state of states) {
    for (const days of Object.values(state.schedules)) {
      for (const weeks of Object.values(days)) {
        for (const id of Object.values(weeks)) if (id) ids.add(id)
      }
    }
  }
  return [...ids]
}

/**
 * One food row per recurring slot date in [from, through], minus exclusions.
 * Slots whose vendor has no name in `vendorNames` are skipped, as on the
 * public site; pass one-offs first to dedupeSchedule to let them confirm a slot.
 */
export function expandRecurringFood(
  states: RecurringFoodState[],
  vendorNames: Map<string, string>,
  from: string,
  through: string,
): ScheduleRow[] {
  const rows: ScheduleRow[] = []
  for (const state of states) {
    for (const [location, days] of Object.entries(state.schedules)) {
      const excluded = new Set(state.exclusions[location] ?? [])
      for (const [day, weeks] of Object.entries(days)) {
        for (const [week, vendor] of Object.entries(weeks)) {
          const name = vendor && vendorNames.get(vendor)
          if (!name) continue
          const dates = slotDatesInRange(
            recurringDays.indexOf(day as (typeof recurringDays)[number]),
            recurringOccurrences.indexOf(week as (typeof recurringOccurrences)[number]) + 1,
            state.year,
            from,
            through,
          )
          for (const date of dates) {
            if (!excluded.has(date)) {
              rows.push({ day: date, kind: 'food', name, location, vendor, recurring: true })
            }
          }
        }
      }
    }
  }
  return rows
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
