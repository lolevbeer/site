/**
 * Backfill job application review status: applications saved before the field existed
 * become `reviewed`, so only new submissions (schema default `new`) show as waiting.
 */
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.collections['job-applications'].collection.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'reviewed' } },
  )
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Leave the field; an older build ignores it.
}
