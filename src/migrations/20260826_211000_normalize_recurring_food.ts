import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'
import {
  recurringDays,
  recurringOccurrences,
  type RecurringFoodExclusionsData,
  type RecurringFoodSchedulesData,
} from '@/src/utils/recurring-food'

function asObject<T>(value: unknown): T {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : ({} as T)
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const legacy = await payload.findGlobal({
    slug: 'recurring-food',
    depth: 0,
    overrideAccess: true,
    req,
  })

  if (legacy.normalizedAt) return

  const schedules = asObject<RecurringFoodSchedulesData>(legacy.schedules)
  const exclusions = asObject<RecurringFoodExclusionsData>(legacy.exclusions)

  for (const [locationId, locationSchedule] of Object.entries(schedules)) {
    for (const day of recurringDays) {
      for (const occurrence of recurringOccurrences) {
        const vendorId = locationSchedule?.[day]?.[occurrence]
        if (!vendorId) continue

        const existing = await payload.find({
          collection: 'recurring-food-schedules',
          where: {
            and: [
              { location: { equals: locationId } },
              { day: { equals: day } },
              { occurrence: { equals: occurrence } },
            ],
          },
          depth: 0,
          limit: 1,
          overrideAccess: true,
          req,
        })

        if (existing.docs.length === 0) {
          await payload.create({
            collection: 'recurring-food-schedules',
            data: { location: locationId, vendor: vendorId, day, occurrence, active: true },
            context: { skipRevalidate: true },
            overrideAccess: true,
            req,
          })
        }
      }
    }
  }

  for (const [locationId, dates] of Object.entries(exclusions)) {
    for (const date of dates) {
      const dateOnly = date.split('T')[0]
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) continue

      const existing = await payload.find({
        collection: 'recurring-food-exclusions',
        where: {
          and: [
            { location: { equals: locationId } },
            { date: { greater_than_equal: `${dateOnly}T00:00:00.000Z` } },
            { date: { less_than_equal: `${dateOnly}T23:59:59.999Z` } },
          ],
        },
        depth: 0,
        limit: 1,
        overrideAccess: true,
        req,
      })

      if (existing.docs.length === 0) {
        await payload.create({
          collection: 'recurring-food-exclusions',
          data: { location: locationId, date: `${dateOnly}T12:00:00.000Z` },
          context: { skipRevalidate: true },
          overrideAccess: true,
          req,
        })
      }
    }
  }

  await payload.updateGlobal({
    slug: 'recurring-food',
    data: { normalizedAt: new Date().toISOString() },
    context: { skipRevalidate: true },
    overrideAccess: true,
    req,
  })
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  const [scheduleResult, exclusionResult] = await Promise.all([
    payload.find({
      collection: 'recurring-food-schedules',
      depth: 0,
      limit: 10_000,
      overrideAccess: true,
      req,
    }),
    payload.find({
      collection: 'recurring-food-exclusions',
      depth: 0,
      limit: 10_000,
      overrideAccess: true,
      req,
    }),
  ])
  const schedules: RecurringFoodSchedulesData = {}
  const exclusions: RecurringFoodExclusionsData = {}

  for (const schedule of scheduleResult.docs) {
    if (!schedule.active) continue
    const locationId =
      typeof schedule.location === 'object' ? schedule.location.id : schedule.location
    const vendorId = typeof schedule.vendor === 'object' ? schedule.vendor.id : schedule.vendor
    schedules[locationId] ??= {}
    schedules[locationId][schedule.day] ??= {}
    schedules[locationId][schedule.day][schedule.occurrence] = vendorId
  }

  for (const exclusion of exclusionResult.docs) {
    const locationId =
      typeof exclusion.location === 'object' ? exclusion.location.id : exclusion.location
    exclusions[locationId] ??= []
    exclusions[locationId].push(exclusion.date.split('T')[0])
  }

  await payload.updateGlobal({
    slug: 'recurring-food',
    data: { schedules, exclusions, normalizedAt: null },
    context: { skipRevalidate: true },
    overrideAccess: true,
    req,
  })

  for (const schedule of scheduleResult.docs) {
    await payload.delete({
      collection: 'recurring-food-schedules',
      id: schedule.id,
      context: { skipRevalidate: true },
      overrideAccess: true,
      req,
    })
  }
  for (const exclusion of exclusionResult.docs) {
    await payload.delete({
      collection: 'recurring-food-exclusions',
      id: exclusion.id,
      context: { skipRevalidate: true },
      overrideAccess: true,
      req,
    })
  }
}
