import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  for (const slug of ['donation-requests', 'job-applications']) {
    await payload.db.collections[slug].collection.createIndex(
      { submissionKey: 1 },
      { unique: true, sparse: true },
    )
  }
  await payload.db.connection
    .collection('public-form-limits')
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Keep integrity indexes and outstanding reservations on an app rollback.
}
