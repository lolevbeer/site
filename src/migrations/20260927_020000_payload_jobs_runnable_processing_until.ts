/**
 * Payload 4 replaced the `processing` flag on payload-jobs with a
 * `processingUntil` lease, and the job claim query now filters on the lease.
 * Rebuild the runnable index from 20260826_212000 on the new key so claims
 * stay indexed, with `completedAt` ahead of the lease so finished jobs are
 * skipped, and drop Payload 3's single-field `processing_1` index, which
 * nothing in Payload 4 queries.
 *
 * Existing `processing` values are left in place; Payload 4 never reads them.
 * Payload 3 does: it claims only jobs with `processing: false`. The jobs
 * override in src/payload.config.ts keeps a hidden `processing` field that
 * defaults to false, so jobs Payload 4 creates still run after an app rollback
 * to Payload 3. Jobs created before that field was added lack it (none in
 * production); the recovery manifest has the one-off fix.
 */
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

const RUNNABLE_INDEX = 'payload_jobs_runnable'
const LEGACY_PROCESSING_INDEX = 'processing_1'

/**
 * Exact-match keys first: finished jobs keep `processingUntil: null`, which
 * falls inside the lease range, so `completedAt` must narrow the scan before it.
 * Exported so the recovery manifest test can check the documented key order.
 */
export const RUNNABLE_KEYS = {
  queue: 1,
  completedAt: 1,
  hasError: 1,
  processingUntil: 1,
  waitUntil: 1,
  createdAt: 1,
} as const

type JobsCollection = MigrateUpArgs['payload']['db']['collections'][string]['collection']

async function dropIndexIfPresent(jobs: JobsCollection, name: string): Promise<void> {
  if (await jobs.indexExists(name)) {
    await jobs.dropIndex(name)
  }
}

async function replaceRunnableIndex(jobs: JobsCollection, keys: Record<string, 1>): Promise<void> {
  await dropIndexIfPresent(jobs, RUNNABLE_INDEX)
  await jobs.createIndex(keys, { name: RUNNABLE_INDEX })
}

// No `session` in either direction: index builds on a populated collection
// can't run in a transaction (see 20260826_212000).
export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const jobs = payload.db.collections['payload-jobs'].collection
  await replaceRunnableIndex(jobs, RUNNABLE_KEYS)
  await dropIndexIfPresent(jobs, LEGACY_PROCESSING_INDEX)
}

/** Restores the Payload 3 runnable index; Payload 3 recreates `processing_1` itself (autoIndex). */
export async function down({ payload }: MigrateDownArgs): Promise<void> {
  const jobs = payload.db.collections['payload-jobs'].collection
  await replaceRunnableIndex(jobs, {
    queue: 1,
    processing: 1,
    hasError: 1,
    completedAt: 1,
    waitUntil: 1,
    createdAt: 1,
  })
}
