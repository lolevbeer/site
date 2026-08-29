import type { Event, RecurringEvent } from '@/src/payload-types'
import { getDatesForSlotInYear, toDateKey } from '@/lib/utils/food-dates'
import { recurringDays, recurringOccurrences } from '@/src/utils/recurring-food'

function eventLocationId(event: Pick<Event, 'location'>): string {
  return typeof event.location === 'object' ? event.location.id : event.location
}

function eventIdentity(event: Pick<Event, 'organizer' | 'date' | 'location'>): string {
  return [
    eventLocationId(event),
    event.date.split('T')[0],
    event.organizer.trim().toLocaleLowerCase('en-US'),
  ].join('|')
}

/** Expand date-less monthly definitions into Event-compatible occurrences. */
export function expandRecurringEvents(
  definitions: RecurringEvent[],
  fromDate: string,
  throughDate: string,
): Event[] {
  const events: Event[] = []

  for (const definition of definitions) {
    if (!definition.active) continue
    const dayIndex = recurringDays.indexOf(definition.day)
    if (dayIndex < 0) continue
    const excludedDates = new Set(
      (definition.excludedDates || []).map((excluded) => excluded.date.split('T')[0]),
    )

    for (const occurrence of definition.occurrences) {
      const occurrenceIndex = recurringOccurrences.indexOf(occurrence)
      if (occurrenceIndex < 0) continue

      for (const date of getDatesForSlotInYear(dayIndex, occurrenceIndex + 1, definition.year)) {
        const occurrenceDate = toDateKey(date)
        if (
          occurrenceDate < fromDate ||
          occurrenceDate > throughDate ||
          excludedDates.has(occurrenceDate)
        ) {
          continue
        }

        events.push({
          id: `recurring-${definition.id}-${occurrenceDate}`,
          visibility: definition.visibility,
          organizer: definition.organizer,
          date: `${occurrenceDate}T12:00:00.000Z`,
          startTime: definition.startTime,
          endTime: definition.endTime,
          location: definition.location,
          site: definition.site,
          tags: definition.tags,
          description: definition.description,
          attendees: definition.attendees,
          pointOfContact: definition.pointOfContact,
          email: definition.email,
          phone: definition.phone,
          otherInfo: definition.otherInfo,
          updatedAt: definition.updatedAt,
          createdAt: definition.createdAt,
        })
      }
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date))
}

/** Merge one-off and expanded events, letting an exact one-off override win. */
export function mergeScheduledEvents(oneOff: Event[], recurring: Event[], limit: number): Event[] {
  const oneOffKeys = new Set(oneOff.map(eventIdentity))
  return [...oneOff, ...recurring.filter((event) => !oneOffKeys.has(eventIdentity(event)))]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit)
}
