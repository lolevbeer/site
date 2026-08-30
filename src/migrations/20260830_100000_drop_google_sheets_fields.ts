/**
 * Drops the Google Sheets import URLs from locations and menus.
 *
 * The sheets sync endpoint is gone (nothing reads these any more), but
 * documents written before it was removed still carry the values in Mongo.
 * They are admin-only credentials-ish URLs, so they should not linger in every
 * location and menu document.
 */
import type { MigrateUpArgs } from '@payloadcms/db-mongodb'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  // No `session`: migrations run untransacted here (see 20260826_212000), and
  // $unset is idempotent, so a retry is harmless.
  await payload.db.collections['locations'].collection.updateMany(
    { googleSheets: { $exists: true } },
    { $unset: { googleSheets: '' } },
  )

  await payload.db.versions['locations']?.collection.updateMany(
    { 'version.googleSheets': { $exists: true } },
    { $unset: { 'version.googleSheets': '' } },
  )

  await payload.db.collections['menus'].collection.updateMany(
    { sheetUrl: { $exists: true } },
    { $unset: { sheetUrl: '' } },
  )

  await payload.db.versions['menus']?.collection.updateMany(
    { 'version.sheetUrl': { $exists: true } },
    { $unset: { 'version.sheetUrl': '' } },
  )
}

export async function down(): Promise<void> {
  // No-op: the sheets sync that produced and consumed these URLs is deleted,
  // so there is nothing to restore them for.
}
