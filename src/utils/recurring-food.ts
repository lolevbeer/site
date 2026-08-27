import type { Payload } from 'payload'
import type { RecurringFoodExclusion, RecurringFoodSchedule, User } from '@/src/payload-types'

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

function relationshipID(
  value: RecurringFoodSchedule['location'] | RecurringFoodSchedule['vendor'],
): string {
  return typeof value === 'object' ? value.id : value
}

function legacyObject<T>(value: unknown): T {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : ({} as T)
}

export async function getRecurringFoodState(
  payload: Payload,
  options: RecurringFoodQueryOptions = {},
): Promise<RecurringFoodState> {
  const access = {
    overrideAccess: options.overrideAccess,
    user: options.user,
  }

  const [legacy, scheduleResult, exclusionResult] = await Promise.all([
    payload.findGlobal({
      slug: 'recurring-food',
      depth: 0,
      ...access,
    }),
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

  if (!legacy.normalizedAt) {
    return {
      schedules: legacyObject<RecurringFoodSchedulesData>(legacy.schedules),
      exclusions: legacyObject<RecurringFoodExclusionsData>(legacy.exclusions),
      usingLegacyData: true,
    }
  }

  const schedules: RecurringFoodSchedulesData = {}
  for (const schedule of scheduleResult.docs) {
    if (!schedule.active) continue
    const locationId = relationshipID(schedule.location)
    const vendorId = relationshipID(schedule.vendor)

    schedules[locationId] ??= {}
    schedules[locationId][schedule.day] ??= {}
    schedules[locationId][schedule.day][schedule.occurrence] = vendorId
  }

  const exclusions: RecurringFoodExclusionsData = {}
  for (const exclusion of exclusionResult.docs as RecurringFoodExclusion[]) {
    const locationId = relationshipID(exclusion.location)
    exclusions[locationId] ??= []
    exclusions[locationId].push(exclusion.date.split('T')[0])
  }

  return { schedules, exclusions, usingLegacyData: false }
}
