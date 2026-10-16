import type { Payload } from 'payload'
import type { SlackScheduleEntry } from '@/lib/slack/schedule'
import { toDateKey } from '@/lib/utils/food-dates'
import type { User } from '@/src/payload-types'
import {
  getRecurringFoodState,
  recurringDayName,
  recurringWeekOccurrence,
  recurringDays,
  recurringOccurrences,
} from '@/src/utils/recurring-food'
import { relationshipId } from '@/src/utils/relationship-id'

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

function scheduleYears(from: string, through: string): number[] {
  const firstYear = Number(from.slice(0, 4))
  const lastYear = Number(through.slice(0, 4))
  const years: number[] = []

  for (let year = firstYear; year <= lastYear; year++) years.push(year)

  return years
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
  const years = scheduleYears(from, through)
  const [foodResult, locationsResult, ...recurringStates] = await Promise.all([
    payload.find({
      collection: 'food',
      where: {
        and: [
          { date: { greater_than_equal: `${from}T00:00:00.000Z` } },
          { date: { less_than_equal: `${through}T23:59:59.999Z` } },
        ],
      },
      depth: 1,
      pagination: false,
      limit: 0,
      sort: 'date',
      overrideAccess: false,
      user,
    }),
    payload.find({
      collection: 'locations',
      depth: 0,
      pagination: false,
      limit: 0,
      overrideAccess: false,
      user,
    }),
    ...years.map((year) => getRecurringFoodState(payload, { overrideAccess: false, user, year })),
  ])

  const locationNames = new Map(
    locationsResult.docs.map((location) => [location.id, location.name] as const),
  )
  const recurringByYear = new Map(recurringStates.map((state) => [state.year, state] as const))

  const oneOffEntries: SlackScheduleEntry[] = []
  const oneOffDateVendors = new Set<string>()
  for (const food of foodResult.docs) {
    // Access-denied relationships are bare IDs. Do not turn those IDs into
    // Slack-visible content via the food row's denormalized fields.
    if (!isNamedRelationship(food.location) || !isNamedRelationship(food.vendor)) continue
    const locationId = relationshipId(food.location)
    const vendorId = relationshipId(food.vendor)

    const date = food.date.split('T')[0]
    oneOffDateVendors.add(`${locationId}:${date}:${vendorId}`)
    oneOffEntries.push({
      date,
      title: food.vendor.name,
      location: food.location.name,
      startTime: food.startTime ?? null,
    })
  }

  const recurringVendorIds = new Set<string>()
  for (const state of recurringStates) {
    for (const [locationId, schedule] of Object.entries(state.schedules)) {
      if (!locationNames.has(locationId)) continue
      for (const day of recurringDays) {
        for (const occurrence of recurringOccurrences) {
          const vendorId = schedule[day]?.[occurrence]
          if (vendorId) recurringVendorIds.add(vendorId)
        }
      }
    }
  }

  const vendorNames = new Map<string, string>()
  if (recurringVendorIds.size > 0) {
    const vendorsResult = await payload.find({
      collection: 'food-vendors',
      where: { id: { in: [...recurringVendorIds] } },
      depth: 0,
      limit: recurringVendorIds.size,
      overrideAccess: false,
      user,
    })
    for (const vendor of vendorsResult.docs) vendorNames.set(vendor.id, vendor.name)
  }

  const recurringEntries: SlackScheduleEntry[] = []
  const date = new Date(`${from}T12:00:00`)
  const lastDate = new Date(`${through}T12:00:00`)
  while (date <= lastDate) {
    const dateKey = toDateKey(date)
    const state = recurringByYear.get(date.getFullYear())
    const day = recurringDayName(date)
    const occurrence = recurringOccurrences[recurringWeekOccurrence(date) - 1]

    if (state && occurrence) {
      for (const [locationId, schedule] of Object.entries(state.schedules)) {
        const locationName = locationNames.get(locationId)
        const vendorId = schedule[day]?.[occurrence]
        const vendorName = vendorId ? vendorNames.get(vendorId) : undefined
        if (
          !locationName ||
          !vendorId ||
          !vendorName ||
          state.exclusions[locationId]?.includes(dateKey) ||
          oneOffDateVendors.has(`${locationId}:${dateKey}:${vendorId}`)
        ) {
          continue
        }

        recurringEntries.push({ date: dateKey, title: vendorName, location: locationName })
      }
    }

    date.setDate(date.getDate() + 1)
  }

  return [...oneOffEntries, ...recurringEntries].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime || '').localeCompare(b.startTime || '') ||
      a.location.localeCompare(b.location) ||
      a.title.localeCompare(b.title),
  )
}
