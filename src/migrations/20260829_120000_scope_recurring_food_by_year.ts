import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

// Deliberately NOT imported from LEGACY_SCHEDULE_YEAR: an applied migration is
// a historical snapshot and must not change meaning if the app constant moves.
const INITIAL_YEAR = 2026
const YEAR_INDEX = 'recurring_food_schedule_slot_by_year'

function isLegacySlotIndex(key: Record<string, unknown>): boolean {
  return (
    Object.keys(key).length === 3 && key.location === 1 && key.day === 1 && key.occurrence === 1
  )
}

function isYearSlotIndex(key: Record<string, unknown>): boolean {
  return (
    Object.keys(key).length === 4 &&
    key.location === 1 &&
    key.year === 1 &&
    key.day === 1 &&
    key.occurrence === 1
  )
}

/**
 * Preserve the formerly timeless schedule as the 2026 schedule, then replace
 * its unique slot index so the same location/weekday/occurrence can be managed
 * independently in later years.
 */
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const schedules = payload.db.collections['recurring-food-schedules'].collection

  await schedules.updateMany(
    { $or: [{ year: { $exists: false } }, { year: null }] },
    { $set: { year: INITIAL_YEAR } },
  )

  const indexes = await schedules.indexes()
  for (const index of indexes) {
    if (index.name && isLegacySlotIndex(index.key as Record<string, unknown>)) {
      await schedules.dropIndex(index.name)
    }
  }

  if (!indexes.some((index) => isYearSlotIndex(index.key as Record<string, unknown>))) {
    await schedules.createIndex(
      { location: 1, year: 1, day: 1, occurrence: 1 },
      { name: YEAR_INDEX, unique: true },
    )
  }
}

/** Roll back only while no additional year has been authored, avoiding data loss. */
export async function down({ payload }: MigrateDownArgs): Promise<void> {
  const schedules = payload.db.collections['recurring-food-schedules'].collection
  const laterYear = await schedules.findOne({ year: { $ne: INITIAL_YEAR } })

  if (laterYear) {
    throw new Error('Cannot remove year scoping after schedules for another year have been added')
  }

  for (const index of await schedules.indexes()) {
    if (index.name && isYearSlotIndex(index.key as Record<string, unknown>)) {
      await schedules.dropIndex(index.name)
    }
  }
  await schedules.updateMany({ year: INITIAL_YEAR }, { $unset: { year: '' } })
  await schedules.createIndex(
    { location: 1, day: 1, occurrence: 1 },
    { name: 'location_1_day_1_occurrence_1', unique: true },
  )
}
