/**
 * Drops the pre-year unique slot index on recurring-food-schedules, again.
 *
 * 20260829_120000_scope_recurring_food_by_year already dropped
 * `location_1_day_1_occurrence_1`, but a dropped index is not a permanent
 * state: any Payload process still running the pre-year collection config
 * recreates it on connect via mongoose autoIndex. That happened in practice —
 * a stale `next dev` server put it back minutes after the migration ran, and
 * every attempt to add a slot for a *new* year then failed, because the
 * year-less index saw location+day+occurrence as already taken. Mongo reports
 * that as E11000, which the mongo adapter surfaces as a ValidationError naming
 * the index's first field, so the admin grid showed "field is invalid:
 * location" with nothing wrong with the location.
 *
 * This runs as its own migration rather than by editing the earlier one: that
 * one is recorded as applied and would never run again, and its `down()`
 * deliberately recreates the legacy index.
 */
import type { MigrateUpArgs } from '@payloadcms/db-mongodb'

function isLegacySlotIndex(key: Record<string, unknown>): boolean {
  return (
    Object.keys(key).length === 3 && key.location === 1 && key.day === 1 && key.occurrence === 1
  )
}

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const schedules = payload.db.collections['recurring-food-schedules'].collection

  for (const index of await schedules.indexes()) {
    if (index.name && isLegacySlotIndex(index.key as Record<string, unknown>)) {
      await schedules.dropIndex(index.name)
    }
  }
}

export async function down(): Promise<void> {
  // No-op on purpose: recreating the legacy index is the bug this exists to
  // undo, and the year-scoped index it was replaced by still enforces slot
  // uniqueness.
}
