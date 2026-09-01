/** Recovery evidence for each production migration, in registry order. */
export type MigrationRecoveryMode = 'down' | 'roll-forward' | 'restore'

export interface MigrationRecovery {
  name: string
  compatibility: string
  retry: string
  mode: MigrationRecoveryMode
  verify: string
}

export const migrationRecovery = [
  {
    name: '20260826_210000_normalize_beer_reviews',
    compatibility: 'The deployed app continues reading embedded reviews while normalized review documents are added.',
    retry: 'Review upserts are keyed by source URL, so rerunning does not duplicate normalized reviews.',
    mode: 'down',
    verify: 'Compare normalized review counts and open representative beer detail pages before promotion.',
  },
  {
    name: '20260826_211000_normalize_recurring_food',
    compatibility: 'The legacy recurring-food global remains readable while normalized schedules and exclusions are created.',
    retry: 'Normalized markers and unique slot keys make partially completed schedule conversion safe to rerun.',
    mode: 'down',
    verify: 'Compare schedule and exclusion counts, then inspect both location food pages.',
  },
  {
    name: '20260826_212000_add_payload_jobs_indexes',
    compatibility: 'The migration adds indexes only and does not change the payload-jobs document contract.',
    retry: 'Named index creation is skipped when each target index already exists.',
    mode: 'down',
    verify: 'Inspect the expected payload-jobs indexes and run the maintenance cron once.',
  },
  {
    name: '20260827_120000_drop_menu_lines_last_cleaned',
    compatibility: 'The removed menu values are dead duplicates not read by the current or previously deployed application.',
    retry: 'MongoDB unset operations are idempotent across menu documents and versions.',
    mode: 'roll-forward',
    verify: 'Confirm menu copies are absent and location cleaning data remains authoritative.',
  },
  {
    name: '20260829_120000_scope_recurring_food_by_year',
    compatibility: 'Legacy schedules are preserved as 2026 records and remain readable while year scoping is introduced.',
    retry: 'Year assignment and named index operations tolerate a partially completed earlier run.',
    mode: 'roll-forward',
    verify: 'Confirm the year-scoped unique index and inspect the rendered 2026 food schedules.',
  },
  {
    name: '20260830_100000_drop_google_sheets_fields',
    compatibility: 'The fields are removed only after every application reader and sync endpoint was deleted.',
    retry: 'MongoDB unset operations are idempotent for live documents and stored versions.',
    mode: 'restore',
    verify: 'Confirm the fields are absent; use the recorded Atlas recovery point only if old code must be reinstated.',
  },
  {
    name: '20260830_143000_drop_legacy_recurring_food_slot_index',
    compatibility: 'The removed yearless index conflicts with the current year-scoped schema and is not required by deployed reads.',
    retry: 'The migration scans indexes and drops only a matching legacy key, so an absent index is a safe no-op.',
    mode: 'roll-forward',
    verify: 'Confirm the yearless slot index is absent and the year-scoped uniqueness index remains.',
  },
] as const satisfies readonly MigrationRecovery[]
