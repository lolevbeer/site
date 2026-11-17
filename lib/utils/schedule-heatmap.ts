/**
 * Pure helpers for the admin schedule heatmap widget (server data + client
 * grid). Days are YYYY-MM-DD strings in EST (America/New_York).
 */
import type { RecurringFoodState } from '@/src/utils/recurring-food'
import { recurringDays, recurringOccurrences } from '@/src/utils/recurring-food'
import { getDatesForSlotInYear, toDateKey } from './food-dates'

// The current page starts on this week's Sunday: 8 pages back keep ~4 years of
// history; it plus 2 pages ahead reach ~18 months out.
export const WEEKS = 26 // ~6 months per window
export const PAGES_BACK = 8
export const PAGES_AHEAD = 2

/**
 * One location's bookings on one EST day. `eventDoc` / `foodDoc` are true when
 * a stored document (not only a recurring rule) books it.
 */
export type Day = { events: string[]; food: string[]; eventDoc: boolean; foodDoc: boolean }

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

/** One location's rows grouped by day; names are trimmed, unnamed ones read "Untitled". */
export function groupByDay(rows: ScheduleRow[]): Map<string, Day> {
  const map = new Map<string, Day>()
  for (const r of rows) {
    const day = map.get(r.day) ?? { events: [], food: [], eventDoc: false, foodDoc: false }
    const name = r.name.trim() || 'Untitled'
    if (r.kind === 'event') {
      day.events.push(name)
      day.eventDoc ||= !r.recurring
    } else {
      day.food.push(name)
      day.foodDoc ||= !r.recurring
    }
    map.set(r.day, day)
  }
  return map
}

/**
 * Header line for one location on `today`, events before food: "Tonight:
 * Trivia · Taco Truck", "Tonight: Trivia · no food booked", or, with nothing
 * booked, "Tonight: closed. Next: Fri, Nov 20 · Trivia".
 */
export function tonightSummary(
  byDay: Map<string, Day>,
  today: string,
  closedDays: number[],
): string {
  const tonight = byDay.get(today)
  if (tonight) {
    const names = [...tonight.events, ...tonight.food].join(' · ')
    return `Tonight: ${names}${tonight.food.length ? '' : ' · no food booked'}`
  }
  const status = closedDays.includes(dayOfWeek(today)) ? 'closed' : 'nothing booked'
  const next = [...byDay.keys()].filter((day) => day > today).sort()[0]
  if (!next) return `Tonight: ${status}`
  const { events, food } = byDay.get(next)!
  return `Tonight: ${status}. Next: ${formatDay(next, today)} · ${[...events, ...food].join(' · ')}`
}

/**
 * Hover text for one day, in the legend's words: "Fri, Nov 20 · Event: Trivia
 * · Food: El Rincon", "Wed, Nov 18 · No food booked", "Mon, Nov 23 · Closed".
 * An event always reports missing food, even on a closed day.
 */
export function dayLabel(
  date: string,
  day: Day | undefined,
  closed: boolean,
  today: string,
): string {
  const parts = [formatDay(date, today)]
  if (day?.events.length) parts.push(`Event: ${day.events.join(', ')}`)
  if (day?.food.length) parts.push(`Food: ${day.food.join(', ')}`)
  else parts.push(closed && !day?.events.length ? 'Closed' : 'No food booked')
  return parts.join(' · ')
}

/** Open days from `today` (included) through the next `days` with no food booked. */
export function openNightsWithoutFood(
  byDay: Map<string, Day>,
  today: string,
  closedDays: number[],
  days = 28,
): number {
  let count = 0
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i)
    if (!closedDays.includes(dayOfWeek(date)) && !byDay.get(date)?.food.length) count++
  }
  return count
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Short weekday names, Sunday first (index = dayOfWeek). */
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Short month name of a YYYY-MM-DD date. */
export const monthName = (date: string) => MONTHS[Number(date.slice(5, 7)) - 1]

/** 0 = Sunday for a YYYY-MM-DD date; noon UTC keeps DST out of the math. */
export const dayOfWeek = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay()

/** "Fri, Nov 20"; adds the year when it isn't today's: "Thu, Jan 7, 2027". */
export function formatDay(date: string, today: string): string {
  const day = `${DAY_NAMES[dayOfWeek(date)]}, ${monthName(date)} ${Number(date.slice(8, 10))}`
  return date.slice(0, 4) === today.slice(0, 4) ? day : `${day}, ${date.slice(0, 4)}`
}

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
