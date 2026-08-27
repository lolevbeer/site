import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

const RUNNABLE_INDEX = 'payload_jobs_runnable'
const SCHEDULE_INDEX = 'payload_jobs_schedule_dedupe'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const jobs = payload.db.collections['payload-jobs'].collection

  // Payload opens a transaction for migrations, but MongoDB cannot reliably
  // build indexes transactionally on an existing, populated collection.
  // Named index creation is idempotent, so these deliberately omit `session`.
  await jobs.createIndex(
    { queue: 1, processing: 1, hasError: 1, completedAt: 1, waitUntil: 1, createdAt: 1 },
    { name: RUNNABLE_INDEX },
  )
  await jobs.createIndex(
    { taskSlug: 1, queue: 1, completedAt: 1, createdAt: 1 },
    { name: SCHEDULE_INDEX },
  )
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  const jobs = payload.db.collections['payload-jobs'].collection

  if (await jobs.indexExists(RUNNABLE_INDEX)) {
    await jobs.dropIndex(RUNNABLE_INDEX)
  }
  if (await jobs.indexExists(SCHEDULE_INDEX)) {
    await jobs.dropIndex(SCHEDULE_INDEX)
  }
}
