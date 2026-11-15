/**
 * Text for one recurring series in the Dated Events list columns, used by the
 * "Recurring series" block above that list (RecurringEventsPanel). Pure
 * formatting; kept beside the block because nothing else needs it.
 */
import { formatInTimeZone } from 'date-fns-tz'
import { capitalizeName } from '@/lib/utils/formatters'
import { eventTagOptions } from '@/src/collections/shared/event-fields'
import type { RecurringEvent } from '@/src/payload-types'
import { LEGACY_SCHEDULE_YEAR, recurringOccurrences } from '@/src/utils/recurring-food'

/** The fields the block reads; RecurringEventsPanel selects exactly these. */
export type RecurringSeries = Pick<
  RecurringEvent,
  | 'id'
  | 'active'
  | 'organizer'
  | 'year'
  | 'day'
  | 'occurrences'
  | 'startTime'
  | 'endTime'
  | 'location'
  | 'visibility'
  | 'tags'
  | 'description'
  | 'summary'
  | 'site'
  | 'createdAt'
  | 'updatedAt'
>

const TAPROOM_TIMEZONE = 'America/New_York'
/** The time fields' own `displayFormat` (event-fields.ts), so times read like the dated rows. */
const TIME_FORMAT = 'h:mm a'

/** A stored date or time in taproom time, or blank when unset. */
function formatStored(value: string | null | undefined, format: string): string {
  return value ? formatInTimeZone(value, TAPROOM_TIMEZONE, format) : ''
}

/** Series pattern: "First & Third Wednesday", or "Every Saturday" for all five. */
export function recurringPatternLabel(
  day: RecurringEvent['day'],
  occurrences: RecurringEvent['occurrences'],
): string {
  const chosen = recurringOccurrences.filter((occurrence) => occurrences.includes(occurrence))
  const which =
    chosen.length === recurringOccurrences.length ? 'Every' : chosen.map(capitalizeName).join(' & ')
  return `${which} ${capitalizeName(day)}`
}

/**
 * One series as text, keyed by the Dated Events list's column names. The `date`
 * column holds the pattern and year, since a series has no date. Columns not
 * listed here render blank.
 *
 * @param dateFormat The admin's date format, for the created/updated columns.
 */
export function recurringSeriesCells(
  series: RecurringSeries,
  dateFormat: string,
): Record<string, string> {
  // Series from before the year field existed belong to the 2026 season.
  const year = series.year ?? LEGACY_SCHEDULE_YEAR
  // A location the viewer cannot read (or an unpopulated one) is a bare ID.
  const location = series.location && typeof series.location === 'object' ? series.location : null

  return {
    id: series.id,
    organizer: series.organizer,
    date: `${recurringPatternLabel(series.day, series.occurrences)} · ${year}`,
    startTime: formatStored(series.startTime, TIME_FORMAT),
    endTime: formatStored(series.endTime, TIME_FORMAT),
    location: location?.name ?? '',
    visibility: capitalizeName(series.visibility),
    tags: eventTagOptions
      .filter((option) => series.tags?.includes(option.value))
      .map((option) => option.label)
      .join(', '),
    description: series.description ?? '',
    summary: series.summary ?? '',
    site: series.site ?? '',
    createdAt: formatStored(series.createdAt, dateFormat),
    updatedAt: formatStored(series.updatedAt, dateFormat),
  }
}
