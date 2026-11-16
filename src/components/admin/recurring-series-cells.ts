/**
 * Text for recurring series in the Events list columns, used by the "Recurring
 * series" block above that list (RecurringEventsPanel). Pure formatting and
 * ordering; kept beside the block because nothing else needs it.
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
  | 'image'
  | 'attendees'
  | 'pointOfContact'
  | 'email'
  | 'phone'
  | 'otherInfo'
  | 'createdAt'
  | 'updatedAt'
>

// ponytail: taproom time, while Payload shows the dated rows in the browser's
// zone. The same for staff in Eastern time; format in the browser if that changes.
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
 * One series as text, keyed by the Events list's column names. The `date`
 * column holds the pattern and year, since a series has no date, and `image`
 * the file name. Fields the viewer may not read arrive unset and stay blank.
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
  const image = series.image && typeof series.image === 'object' ? series.image : null

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
    image: image?.filename ?? '',
    attendees: series.attendees == null ? '' : String(series.attendees),
    pointOfContact: series.pointOfContact ?? '',
    email: series.email ?? '',
    phone: series.phone ?? '',
    otherInfo: series.otherInfo ?? '',
    createdAt: formatStored(series.createdAt, dateFormat),
    updatedAt: formatStored(series.updatedAt, dateFormat),
  }
}

/** One row of the block: where it links, whether it is paused, and its cell text. */
export interface RecurringSeriesRow {
  id: string
  href: string
  paused: boolean
  /** Cell text keyed by the Events list's column names. */
  cells: Record<string, string>
}

/**
 * The block's rows, ordered by season then name, so year-less legacy series sit
 * among the 2026 ones they are shown as. Each row carries text for `columns`
 * only, plus the name, which the row's link falls back to. A series that cannot
 * be formatted (bad stored data) goes to `onError` and is left out, so one bad
 * series does not cost the rest.
 */
export function recurringSeriesRows(
  docs: RecurringSeries[],
  options: {
    /** Admin URL of the recurring-events list; each row links to `<listURL>/<id>`. */
    listURL: string
    dateFormat: string
    columns: string[]
    onError: (err: unknown, id: string) => void
  },
): RecurringSeriesRow[] {
  const season = (series: RecurringSeries) => series.year ?? LEGACY_SCHEDULE_YEAR

  return [...docs]
    .sort((a, b) => season(a) - season(b) || a.organizer.localeCompare(b.organizer))
    .flatMap((series) => {
      try {
        const all = recurringSeriesCells(series, options.dateFormat)
        const cells = Object.fromEntries(
          ['organizer', ...options.columns].map((column) => [column, all[column] ?? '']),
        )
        return [
          { id: series.id, href: `${options.listURL}/${series.id}`, paused: !series.active, cells },
        ]
      } catch (err) {
        options.onError(err, series.id)
        return []
      }
    })
}
