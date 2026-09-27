/**
 * Recovery evidence for each production migration, in registry order.
 *
 * Lives in a subdirectory because `payload migrate` loads every `.ts`/`.js`
 * sibling of `src/migrations/index.ts` (except index itself) and calls `up()`.
 * A sibling `recovery.ts` is treated as a migration named `recovery`.
 */
export type MigrationRecoveryMode = 'down' | 'roll-forward' | 'restore'

export interface MigrationRecovery {
  name: string
  compatibility: string
  retry: string
  mode: MigrationRecoveryMode
  verify: string
}

export const migrationRecovery: readonly MigrationRecovery[] = [
  {
    name: '20260826_210000_normalize_beer_reviews',
    compatibility:
      'The deployed app continues reading embedded reviews while normalized review documents are added.',
    retry:
      'Rerun only as a roll-forward: review upserts are keyed by source URL, and the immutable down migration is not production recovery.',
    mode: 'roll-forward',
    verify:
      'Expected count is distinct legacy reviews with both URL and text; each URL must retain its source beer association, and skipped or cross-beer URL keys must be enumerated.',
  },
  {
    name: '20260826_211000_normalize_recurring_food',
    compatibility:
      'The legacy recurring-food global remains readable while normalized schedules and exclusions are created.',
    retry:
      'Before retrying, record normalized schedule and exclusion counts at or below 10,000 and investigate duplicate keys; otherwise use a reviewed roll-forward.',
    mode: 'roll-forward',
    verify:
      'For populated schedule slots and valid exclusion dates, matched normalized counts must equal distinct legacy keys; enumerate skipped keys and confirm normalizedAt is set.',
  },
  {
    name: '20260826_212000_add_payload_jobs_indexes',
    compatibility:
      'The migration adds indexes only and does not change the payload-jobs document contract.',
    retry:
      'Inspect both named indexes first; retry is safe only when each target is absent or already has its exact required key and options.',
    mode: 'roll-forward',
    verify:
      'Read-only inspect payload_jobs_runnable (queue, processing, hasError, completedAt, waitUntil, createdAt) and payload_jobs_schedule_dedupe (taskSlug, queue, completedAt, createdAt), both with name-only options; observe the next scheduled maintenance run.',
  },
  {
    name: '20260827_120000_drop_menu_lines_last_cleaned',
    compatibility:
      'The removed menu values are dead duplicates not read by the current or previously deployed application.',
    retry: 'MongoDB unset operations are idempotent across menu documents and versions.',
    mode: 'roll-forward',
    verify: 'Confirm menu copies are absent and location cleaning data remains authoritative.',
  },
  {
    name: '20260829_120000_scope_recurring_food_by_year',
    compatibility:
      'Legacy schedules are preserved as 2026 records and remain readable while year scoping is introduced.',
    retry:
      'Quiesce schedule writes before retrying: a partial run may have dropped the legacy slot index without creating the year index, leaving no unique guard until the retry completes.',
    mode: 'roll-forward',
    verify:
      'Confirm no duplicate location/year/day/occurrence slots exist, confirm the year-scoped unique index, and inspect the rendered 2026 food schedules.',
  },
  {
    name: '20260830_100000_drop_google_sheets_fields',
    compatibility:
      'A failed build leaves the prior deployment live, where its Google Sheets sync endpoint reads these fields: location imports become not configured and menus use only the environment fallback.',
    retry:
      'The unsets are idempotent, but a failed build requires an immediate compatible roll-forward or Atlas restore rather than leaving the prior sync endpoint degraded.',
    mode: 'restore',
    verify:
      'Confirm the fields are absent; after a failed build, choose Atlas restore or immediate compatible roll-forward before the live prior deployment continues serving degraded sync.',
  },
  {
    name: '20260830_143000_drop_legacy_recurring_food_slot_index',
    compatibility:
      'The removed yearless index conflicts with the current year-scoped schema and is not required by deployed reads.',
    retry:
      'The migration scans indexes and drops only a matching legacy key, so an absent index is a safe no-op.',
    mode: 'roll-forward',
    verify:
      'Confirm the yearless slot index is absent and the year-scoped uniqueness index remains.',
  },
  {
    name: '20260926_190000_backfill_missing_beer_reviews',
    compatibility:
      'Only adds beer-reviews documents for beers that have none; the previously deployed app still falls back to embedded legacy reviews, so both versions render the same reviews.',
    retry:
      'Safe to rerun: it skips any beer that already has review documents, and review upserts are keyed by source URL.',
    mode: 'roll-forward',
    verify:
      'Run scripts/check-legacy-reviews.ts: beers with legacy positiveReviews but zero beer-reviews documents must be 0 (Taupō was the only one on 2026-09-26).',
  },
  {
    name: '20260927_020000_payload_jobs_runnable_processing_until',
    compatibility:
      "Index-only: rebuilds payload_jobs_runnable on processingUntil (completedAt moved second) and drops Payload 3's processing_1; either index only changes claim speed. App rollback: Payload 3 claims only jobs with processing: false, and the jobs override in src/payload.config.ts gives every job Payload 4 creates that value. Jobs created before that field was added lack it (none in production); db['payload-jobs'].updateMany({ completedAt: { $exists: false }, processing: { $exists: false } }, { $set: { processing: false } }) fixes them and is safe to run before any rollback.",
    retry:
      'Safe to rerun: it drops each named index if present and recreates payload_jobs_runnable with the exact key.',
    mode: 'roll-forward',
    verify:
      'Read-only inspect payload_jobs_runnable (queue, completedAt, hasError, processingUntil, waitUntil, createdAt) with name-only options; observe the next scheduled maintenance run. processing_1 may reappear while any Payload 3 deployment still connects (its Mongoose autoIndex recreates it): harmless, since Payload 4 never queries it; drop it once no Payload 3 deployment remains.',
  },
]
