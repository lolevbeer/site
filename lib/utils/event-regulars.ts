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

/**
 * Weekly when every gap is a whole number of weeks and at least half the gaps
 * are exactly one week. That tolerates an excluded holiday or a first-to-fourth schedule
 * skipping a month's fifth weekday, while monthly and every-other-week series
 * stay in the dated list.
 */
function isWeekly(events: BreweryEvent[]): boolean {
  if (events.length < 2) return false
  const weeks = events
    .slice(1)
    .map(
      (event, i) =>
        (parseLocalDate(event.date).getTime() - parseLocalDate(events[i].date).getTime()) / WEEK_MS,
    )
    .map(Math.round)
  if (weeks.some((gap) => gap < 1)) return false
  const oneWeekGaps = weeks.filter((gap) => gap === 1).length
  return oneWeekGaps > 0 && oneWeekGaps * 2 >= weeks.length
}

/**
 * Recurring occurrences that share title, location, time, and weekday and
 * repeat weekly become one regular. A one-off with the same key joins its
 * series: that is how a mergeScheduledEvents override of one occurrence
 * looks. Everything else (one-offs, monthly schedules, a lone occurrence)
 * stays in the dated list.
 */
export function splitRegulars(events: BreweryEvent[]): {
  oneOffs: BreweryEvent[]
  regulars: RegularEvent[]
} {
  const recurringKeys = new Set(
    events.filter((event) => event.type === EventType.RECURRING).map(regularKey),
  )
  const groups = new Map<string, BreweryEvent[]>()
  for (const event of events) {
    const key = regularKey(event)
    if (!recurringKeys.has(key)) continue
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
