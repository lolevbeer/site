import type { Payload, Where } from 'payload'
import type { RecurringFoodExclusion, User } from '@/src/payload-types'
import { relationshipId } from '@/src/utils/relationship-id'

export const recurringDays = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

export const recurringOccurrences = ['first', 'second', 'third', 'fourth', 'fifth'] as const

/**
 * Sanity bounds for the schedule-year fields. Shared by the collections'
 * min/max, the server actions' validation, and the admin grid's year picker so
 * loosening them is a one-place change.
 */
export const RECURRING_YEAR_MIN = 2000
export const RECURRING_YEAR_MAX = 2100

/**
 * Rows created before the year fields existed have no year in the DB; they
 * were authored for the 2026 season. Reads treat a missing year as 2026 so
 * legacy rows keep working even before the year backfill migration runs.
 */
export const LEGACY_SCHEDULE_YEAR = 2026

/** Year filter that also matches legacy year-less rows when querying 2026. */
export function scheduleYearFilter(year: number): Where {
  return year === LEGACY_SCHEDULE_YEAR
    ? { or: [{ year: { equals: year } }, { year: { exists: false } }] }
    : { year: { equals: year } }
}

/**
 * The `recurringDays` entry for a date. Lives here because the value only means
 * anything against that array's ordering.
 */
export function recurringDayName(date: Date): (typeof recurringDays)[number] {
  return recurringDays[date.getDay()]
}

/** Which occurrence of its weekday a date is within its month (1-5). */
export function recurringWeekOccurrence(date: Date): number {
  return Math.ceil(date.getDate() / 7)
}

export type RecurringFoodSchedulesData = Record<
  string,
  Record<string, Record<string, string | null>>
>
export type RecurringFoodExclusionsData = Record<string, string[]>

export interface RecurringFoodState {
  year: number
  schedules: RecurringFoodSchedulesData
  exclusions: RecurringFoodExclusionsData
  usingLegacyData: boolean
}

interface RecurringFoodQueryOptions {
  overrideAccess?: boolean
  user?: User
  year?: number
}

/** Coerce a legacy global's untyped JSON field into a keyed record. */
export function legacyObject<T>(value: unknown): T {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : ({} as T)
}

/** UTC day window for querying an exclusion stored as a datetime. */
export function dayBounds(dateOnly: string): { start: string; end: string } {
  return { start: `${dateOnly}T00:00:00.000Z`, end: `${dateOnly}T23:59:59.999Z` }
}

/** Canonical timestamp for writing a date-only exclusion (noon UTC avoids TZ drift). */
export function exclusionTimestamp(dateOnly: string): string {
  return `${dateOnly}T12:00:00.000Z`
}

export async function getRecurringFoodState(
  payload: Payload,
  options: RecurringFoodQueryOptions = {},
): Promise<RecurringFoodState> {
  const year = options.year ?? new Date().getFullYear()
  const access = {
    overrideAccess: options.overrideAccess,
    user: options.user,
  }

  const legacy = await payload.findGlobal({
    slug: 'recurring-food',
    depth: 0,
    ...access,
  })

  if (!legacy.normalizedAt) {
    return {
      year,
      schedules: legacyObject<RecurringFoodSchedulesData>(legacy.schedules),
      exclusions: legacyObject<RecurringFoodExclusionsData>(legacy.exclusions),
      usingLegacyData: true,
    }
  }

  const [scheduleResult, exclusionResult] = await Promise.all([
    payload.find({
      collection: 'recurring-food-schedules',
      // Filter in the query, not after: the 1000-row cap must apply to active
      // schedules, otherwise archived rows can crowd out live ones.
      where: {
        and: [{ active: { equals: true } }, scheduleYearFilter(year)],
      },
      depth: 0,
      limit: 1000,
      sort: ['location', 'day', 'occurrence'],
      ...access,
    }),
    payload.find({
      collection: 'recurring-food-exclusions',
      where: {
        and: [
          { date: { greater_than_equal: `${year}-01-01T00:00:00.000Z` } },
          { date: { less_than_equal: `${year}-12-31T23:59:59.999Z` } },
        ],
      },
      depth: 0,
      limit: 1000,
      sort: 'date',
      ...access,
    }),
  ])

  const schedules: RecurringFoodSchedulesData = {}
  for (const schedule of scheduleResult.docs) {
    const locationId = relationshipId(schedule.location)
    const vendorId = relationshipId(schedule.vendor)

    schedules[locationId] ??= {}
    schedules[locationId][schedule.day] ??= {}
    schedules[locationId][schedule.day][schedule.occurrence] = vendorId
  }

  const exclusions: RecurringFoodExclusionsData = {}
  for (const exclusion of exclusionResult.docs as RecurringFoodExclusion[]) {
    const locationId = relationshipId(exclusion.location)
    exclusions[locationId] ??= []
    exclusions[locationId].push(exclusion.date.split('T')[0])
  }

  return { year, schedules, exclusions, usingLegacyData: false }
}
