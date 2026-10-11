/**
 * Splits /events into dated one-offs and weekly "regulars" (Trivia, Taco
 * Tuesday) so the repeating rows stop burying the specials. Pure and
 * client-safe.
 */
import { EventType, type BreweryEvent } from '@/lib/types/event'
import { formatTime, parseLocalDate } from '@/lib/utils/formatters'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export interface RegularEvent {
  /** The soonest occurrence; its id, date, and location drive the row. */
  next: BreweryEvent
  /** Every collapsed occurrence id, in date order, kept as page anchors. */
  occurrenceIds: string[]
}

function regularKey(event: BreweryEvent): string {
  return [
    event.location,
    event.title.trim().toLowerCase(),
    event.time,
    parseLocalDate(event.date).getDay(),
  ].join('|')
}

function isWeekly(events: BreweryEvent[]): boolean {
  if (events.length < 2) return false
  return events.every(
    (event, i) =>
      i === 0 ||
      Math.round(
        (parseLocalDate(event.date).getTime() - parseLocalDate(events[i - 1].date).getTime()) /
          WEEK_MS,
      ) === 1,
  )
}

/**
 * Recurring occurrences that share title, location, time, and weekday and
 * fall exactly a week apart become one regular; everything else (one-offs,
 * monthly schedules, a lone occurrence) stays in the dated list.
 */
export function splitRegulars(events: BreweryEvent[]): {
  oneOffs: BreweryEvent[]
  regulars: RegularEvent[]
} {
  const groups = new Map<string, BreweryEvent[]>()
  for (const event of events) {
    if (event.type !== EventType.RECURRING) continue
    const key = regularKey(event)
    groups.set(key, [...(groups.get(key) ?? []), event])
  }

  const collapsed = new Set<BreweryEvent>()
  const regulars: RegularEvent[] = []
  for (const group of groups.values()) {
    const sorted = group.slice().sort((a, b) => a.date.localeCompare(b.date))
    if (!isWeekly(sorted)) continue
    sorted.forEach((event) => collapsed.add(event))
    regulars.push({ next: sorted[0], occurrenceIds: sorted.map((event) => String(event.id)) })
  }

  regulars.sort((a, b) => a.next.date.localeCompare(b.next.date))
  return { oneOffs: events.filter((event) => !collapsed.has(event)), regulars }
}

/** "Wednesdays 7pm · Trivia"; the time drops out when missing or TBD. */
export function regularLabel(event: BreweryEvent): string {
  const weekday = parseLocalDate(event.date).toLocaleDateString('en-US', { weekday: 'long' })
  const time = event.time && event.time.toLowerCase() !== 'tbd' ? ` ${formatTime(event.time)}` : ''
  return `${weekday}s${time} · ${event.title}`
}
