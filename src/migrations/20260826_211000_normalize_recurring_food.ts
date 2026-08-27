import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'
import {
  exclusionTimestamp,
  legacyObject,
  recurringDays,
  recurringOccurrences,
  type RecurringFoodExclusionsData,
  type RecurringFoodSchedulesData,
} from '@/src/utils/recurring-food'
import { relationshipId } from '@/src/utils/relationship-id'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const legacy = await payload.findGlobal({
    slug: 'recurring-food',
    depth: 0,
    overrideAccess: true,
    req,
  })

  if (legacy.normalizedAt) return

  const schedules = legacyObject<RecurringFoodSchedulesData>(legacy.schedules)
  const exclusions = legacyObject<RecurringFoodExclusionsData>(legacy.exclusions)

  // Prefetch existing rows once instead of one existence query per slot/date.
  const [existingSchedules, existingExclusions] = await Promise.all([
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
  const scheduleKeys = new Set(
    existingSchedules.docs.map((s) => `${relationshipId(s.location)}|${s.day}|${s.occurrence}`),
  )
  const exclusionKeys = new Set(
    existingExclusions.docs.map((e) => `${relationshipId(e.location)}|${e.date.split('T')[0]}`),
  )

  for (const [locationId, locationSchedule] of Object.entries(schedules)) {
    for (const day of recurringDays) {
      for (const occurrence of recurringOccurrences) {
        const vendorId = locationSchedule?.[day]?.[occurrence]
        if (!vendorId) continue
        if (scheduleKeys.has(`${locationId}|${day}|${occurrence}`)) continue

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

  for (const [locationId, dates] of Object.entries(exclusions)) {
    for (const date of dates) {
      const dateOnly = date.split('T')[0]
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) continue
      if (exclusionKeys.has(`${locationId}|${dateOnly}`)) continue

      await payload.create({
        collection: 'recurring-food-exclusions',
        data: { location: locationId, date: exclusionTimestamp(dateOnly) },
        context: { skipRevalidate: true },
        overrideAccess: true,
        req,
      })
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
    const locationId = relationshipId(schedule.location)
    const vendorId = relationshipId(schedule.vendor)
    schedules[locationId] ??= {}
    schedules[locationId][schedule.day] ??= {}
    schedules[locationId][schedule.day][schedule.occurrence] = vendorId
  }

  for (const exclusion of exclusionResult.docs) {
    const locationId = relationshipId(exclusion.location)
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

  // Bulk where-based deletes instead of one round trip per doc.
  await payload.delete({
    collection: 'recurring-food-schedules',
    where: { id: { exists: true } },
    context: { skipRevalidate: true },
    overrideAccess: true,
    req,
  })
  await payload.delete({
    collection: 'recurring-food-exclusions',
    where: { id: { exists: true } },
    context: { skipRevalidate: true },
    overrideAccess: true,
    req,
  })
}
