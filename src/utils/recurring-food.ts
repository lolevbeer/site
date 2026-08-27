import type { Payload } from 'payload'
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

export type RecurringFoodSchedulesData = Record<
  string,
  Record<string, Record<string, string | null>>
>
export type RecurringFoodExclusionsData = Record<string, string[]>

export interface RecurringFoodState {
  schedules: RecurringFoodSchedulesData
  exclusions: RecurringFoodExclusionsData
  usingLegacyData: boolean
}

interface RecurringFoodQueryOptions {
  overrideAccess?: boolean
  user?: User
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
      schedules: legacyObject<RecurringFoodSchedulesData>(legacy.schedules),
      exclusions: legacyObject<RecurringFoodExclusionsData>(legacy.exclusions),
      usingLegacyData: true,
    }
  }

  const [scheduleResult, exclusionResult] = await Promise.all([
    payload.find({
      collection: 'recurring-food-schedules',
      depth: 0,
      limit: 1000,
      sort: ['location', 'day', 'occurrence'],
      ...access,
    }),
    payload.find({
      collection: 'recurring-food-exclusions',
      depth: 0,
      limit: 1000,
      sort: 'date',
      ...access,
    }),
  ])

  const schedules: RecurringFoodSchedulesData = {}
  for (const schedule of scheduleResult.docs) {
    if (!schedule.active) continue
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

  return { schedules, exclusions, usingLegacyData: false }
}
