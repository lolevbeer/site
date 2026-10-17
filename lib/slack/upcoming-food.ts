/**
 * Food over the next N days for `/lolevbeer food`: one-off Food rows plus
 * recurring slots, read as the Slack requester and expanded by the same
 * helpers as the admin schedule heatmap (active locations only, like /food).
 */
import type { Payload } from 'payload'
import type { SlackScheduleEntry } from '@/lib/slack/schedule'
import { getDateEST, getESTMidnightISO } from '@/lib/utils/date'
import {
  addDays,
  dedupeSchedule,
  expandRecurringFood,
  recurringFoodVendorIds,
  scheduleYears,
  type ScheduleRow,
} from '@/lib/utils/schedule-heatmap'
import type { User } from '@/src/payload-types'
import { getRecurringFoodState } from '@/src/utils/recurring-food'

interface NamedRelationship {
  id: string
  name: string
}

function isNamedRelationship(value: unknown): value is NamedRelationship {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string'
  )
}

/**
 * Returns food scheduled in the inclusive Pittsburgh calendar window for the
 * authenticated Slack requester. Relationship IDs are intentionally never
 * returned when the requester cannot read the related document.
 */
export async function findUpcomingSlackFood(
  payload: Payload,
  user: User,
  from: string,
  through: string,
): Promise<SlackScheduleEntry[]> {
  const [foodResult, locationsResult, recurringStates] = await Promise.all([
    payload.find({
      collection: 'food',
      where: {
        and: [
          { date: { greater_than_equal: getESTMidnightISO(from) } },
          { date: { less_than: getESTMidnightISO(addDays(through, 1)) } },
        ],
      },
      depth: 1,
      select: { date: true, startTime: true, location: true, vendor: true },
      populate: { locations: { name: true }, 'food-vendors': { name: true } },
      pagination: false,
      limit: 0,
      overrideAccess: false,
      user,
    }),
    payload.find({
      collection: 'locations',
      // Same filter as the public /food page: closed locations list nothing.
      where: { active: { equals: true } },
      select: { name: true },
      depth: 0,
      pagination: false,
      limit: 0,
      overrideAccess: false,
      user,
    }),
    Promise.all(
      scheduleYears(from, through).map((year) =>
        getRecurringFoodState(payload, { overrideAccess: false, user, year }),
      ),
    ),
  ])

  const locationNames = new Map(locationsResult.docs.map((l) => [l.id, l.name] as const))

  // Access-denied relationships are bare IDs. Do not turn those IDs into
  // Slack-visible content via the food row's denormalized fields.
  const oneOffs: (ScheduleRow & { startTime?: string | null })[] = foodResult.docs.flatMap(
    (food) =>
      isNamedRelationship(food.location) && isNamedRelationship(food.vendor)
        ? [
            {
              day: getDateEST(new Date(food.date)),
              kind: 'food' as const,
              name: food.vendor.name,
              location: food.location.id,
              vendor: food.vendor.id,
              startTime: food.startTime ?? null,
            },
          ]
        : [],
  )

  const vendorIds = recurringFoodVendorIds(recurringStates)
  const vendorNames = new Map<string, string>()
  if (vendorIds.length > 0) {
    const vendorsResult = await payload.find({
      collection: 'food-vendors',
      where: { id: { in: vendorIds } },
      depth: 0,
      pagination: false,
      select: { name: true },
      overrideAccess: false,
      user,
    })
    for (const vendor of vendorsResult.docs) vendorNames.set(vendor.id, vendor.name)
  }

  // One-offs first so a stored row confirms (replaces) its recurring slot.
  const rows = dedupeSchedule([
    ...oneOffs,
    ...expandRecurringFood(recurringStates, vendorNames, from, through),
  ]) as (ScheduleRow & { startTime?: string | null })[]

  return rows.flatMap((row) => {
    const location = locationNames.get(row.location)
    if (!location) return []
    const entry: SlackScheduleEntry = { date: row.day, title: row.name, location }
    if (!row.recurring) entry.startTime = row.startTime ?? null
    return [entry]
  })
}
