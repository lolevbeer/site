/**
 * Drops the stale `linesLastCleaned` field from menu documents.
 *
 * The cleaning cadence moved onto Locations (see the shared thresholds in
 * src/components/admin/lines-cleaned.ts), but menus created before that still
 * carry the old copy in Mongo. Nothing reads it, yet it ships in every /m
 * render and every menu poll response.
 */
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  // No `session`: migrations run untransacted here (see 20260826_212000), and
  // $unset is idempotent, so a retry is harmless.
  await payload.db.collections['menus'].collection.updateMany(
    { linesLastCleaned: { $exists: true } },
    { $unset: { linesLastCleaned: '' } },
  )

  await payload.db.versions['menus']?.collection.updateMany(
    { 'version.linesLastCleaned': { $exists: true } },
    { $unset: { 'version.linesLastCleaned': '' } },
  )
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // No-op: the dropped values were already dead data with no source to restore
  // from. Locations.linesLastCleaned remains the single source of truth.
}
