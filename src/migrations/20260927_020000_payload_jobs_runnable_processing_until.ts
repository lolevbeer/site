/**
 * Payload 4 replaced the `processing` flag on payload-jobs with a
 * `processingUntil` lease, and the job claim query now filters on the lease.
 * Rebuild the runnable index from 20260826_212000 on the new key so claims
 * stay indexed, with `completedAt` ahead of the lease so finished jobs are skipped. Existing `processing` values are left in place: nothing reads
 * them, and a v3 job stuck at `processing: true` has no lease, so v4 can claim it.
 */
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

const RUNNABLE_INDEX = 'payload_jobs_runnable'

async function replaceRunnableIndex(
  { payload }: MigrateUpArgs | MigrateDownArgs,
  keys: Record<string, 1>,
): Promise<void> {
  const jobs = payload.db.collections['payload-jobs'].collection

  // No `session`: index builds on a populated collection can't run in a
  // transaction (see 20260826_212000).
  if (await jobs.indexExists(RUNNABLE_INDEX)) {
    await jobs.dropIndex(RUNNABLE_INDEX)
  }
  await jobs.createIndex(keys, { name: RUNNABLE_INDEX })
}

export async function up(args: MigrateUpArgs): Promise<void> {
  // Exact-match keys first: finished jobs keep `processingUntil: null`, which
  // falls inside the lease range, so `completedAt` must narrow the scan before it.
  await replaceRunnableIndex(args, {
    queue: 1,
    completedAt: 1,
    hasError: 1,
    processingUntil: 1,
    waitUntil: 1,
    createdAt: 1,
  })
}

export async function down(args: MigrateDownArgs): Promise<void> {
  await replaceRunnableIndex(args, {
    queue: 1,
    processing: 1,
    hasError: 1,
    completedAt: 1,
    waitUntil: 1,
    createdAt: 1,
  })
}
