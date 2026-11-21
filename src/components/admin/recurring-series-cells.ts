/**
 * Rows for the recurring blocks above two admin lists (RecurringSeriesBlock):
 * recurring event series in the Events list's columns (RecurringEventsPanel),
 * and Food Recurring grid slots in the Food Bookings list's columns
 * (RecurringFoodPanel). Pure formatting and ordering.
 */
import { formatInTimeZone } from 'date-fns-tz'
import { capitalizeName } from '@/lib/utils/formatters'
import { relationshipId } from '@/src/utils/relationship-id'
import { eventTagOptions } from '@/src/collections/shared/event-fields'
import type { RecurringEvent, RecurringFoodSchedule } from '@/src/payload-types'
import {
  LEGACY_SCHEDULE_YEAR,
  recurringDays,
  recurringOccurrences,
} from '@/src/utils/recurring-food'

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

/** One row of a recurring block: where it links, whether it is paused, and its cell text. */
export interface RecurringSeriesRow {
  id: string
  href: string
  /** The row's name; the link shows it when the first column is blank. */
  title: string
  paused: boolean
  /** Cell text keyed by the list's column names (Events or Food Bookings). */
  cells: Record<string, string>
}

/**
 * The block's rows, ordered by season then name, so year-less legacy series sit
 * among the 2026 ones they are shown as. Each row carries text for `columns`
 * only. A series that cannot be formatted (bad stored data) goes to `onError`
 * and is left out, so one bad series does not cost the rest.
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
        return [
          {
            id: series.id,
            href: `${options.listURL}/${series.id}`,
            title: series.organizer,
            paused: !series.active,
            cells: pickColumns(all, options.columns),
          },
        ]
      } catch (err) {
        options.onError(err, series.id)
        return []
      }
    })
}

/** Text for `columns` only, blank where there is none, so hidden columns are not sent. */
function pickColumns(all: Record<string, string>, columns: string[]): Record<string, string> {
  return Object.fromEntries(columns.map((column) => [column, all[column] ?? '']))
}

/** The fields the food block reads; RecurringFoodPanel selects exactly these (active slots only). */
export type RecurringFoodSlot = Pick<
  RecurringFoodSchedule,
  'id' | 'year' | 'day' | 'occurrence' | 'vendor' | 'location'
>

/**
 * A populated relationship's name; blank for a bare ID the viewer cannot read
 * or null, which is how a trashed vendor populates.
 */
function relationName(value: string | { name?: string | null } | null | undefined): string {
  return value && typeof value === 'object' ? (value.name ?? '') : ''
}

/** A relationship's ID, or '' for null (a trashed vendor). */
function relationKey(value: string | { id: string } | null): string {
  return value ? relationshipId(value) : ''
}

/**
 * Food Recurring grid slots (one per taproom, weekday and week of the month)
 * as Food Bookings list rows: one per season, taproom, weekday and vendor,
 * with the weeks joined into a pattern ("First & Third Friday · 2026") in the
 * `date` column. Every row links to `href`, the grid, since a slot has no edit
 * form of its own. Ordered by season, taproom, weekday, then vendor. A group
 * that cannot be formatted (bad stored data) goes to `onError` and is left
 * out, so one bad slot does not cost the rest.
 */
export function recurringFoodRows(
  slots: RecurringFoodSlot[],
  options: {
    href: string
    columns: string[]
    onError: (err: unknown, key: string) => void
  },
): RecurringSeriesRow[] {
  const groups = new Map<string, RecurringFoodSlot[]>()
  for (const slot of slots) {
    const key = [slot.year, relationKey(slot.location), slot.day, relationKey(slot.vendor)].join(
      '|',
    )
    const group = groups.get(key)
    if (group) group.push(slot)
    else groups.set(key, [slot])
  }

  return [...groups]
    .sort(
      ([, [a]], [, [b]]) =>
        a.year - b.year ||
        relationName(a.location).localeCompare(relationName(b.location)) ||
        recurringDays.indexOf(a.day) - recurringDays.indexOf(b.day) ||
        relationName(a.vendor).localeCompare(relationName(b.vendor)),
    )
    .flatMap(([key, group]) => {
      try {
        const [first] = group
        const vendor = relationName(first.vendor)
        const pattern = recurringPatternLabel(
          first.day,
          group.map((slot) => slot.occurrence),
        )
        const all = {
          vendor,
          date: `${pattern} · ${first.year}`,
          location: relationName(first.location),
        }
        return [
          {
            id: key,
            href: options.href,
            title: vendor || 'Unknown vendor',
            paused: false,
            cells: pickColumns(all, options.columns),
          },
        ]
      } catch (err) {
        options.onError(err, key)
        return []
      }
    })
}
