# Production deployment runbook

## Scope and accepted risk

This runbook governs production releases that may run Payload migrations. Vercel production builds run `pnpm migrate` before the deployment is promoted. Vercel auto-deploy remains the accepted deployment model.

Migrations can mutate MongoDB before a build later fails. In that case, the prior deployment can remain live against a partially mutated database; the process is **not atomic**. Do not retry, roll back, or restore from memory. Use the compatibility, retry, mode, and verification evidence for every pending migration in [`src/migrations/recovery/index.ts`](../../src/migrations/recovery/index.ts), then record the decision below. Keep that manifest in its subdirectory: `payload migrate` treats every `.ts`/`.js` sibling of `src/migrations/index.ts` as a migration and calls `up()`.

Payload's migration down operation is batch-scoped, not per-migration recovery: it acts on the latest recorded batch and cannot clean up an unrecorded failed migration. This runbook does not authorize `migrate:down`. Recover failed pending migrations by a manifest-approved retry or an explicitly reviewed targeted roll-forward or cleanup procedure.

Do not place credentials, cluster names, recovery-point IDs, or other production evidence in this document or in source control.

## Release owner and recovery-point evidence

Before merging, name one release owner responsible for this release and record the following in the release record:

- release owner and a reachable escalation contact;
- the Atlas recovery-point ID and timestamp verified for the selected production database;
- the person authorized to request a restore and the restore owner who will execute it;
- the commit to deploy and the pending migration names from the production-status wrapper;
- the non-secret database target fingerprint returned by that wrapper.

A release is blocked if the recovery-point ID, timestamp, restore authorization, restore owner, or target fingerprint is missing.

## Pre-merge checks

Run these commands in CI or a local checkout before merging. The build must use a disposable, non-production database context supplied by the approved non-production secret wrapper; the wrapper must reject a production database target. Do not run the build unless the non-secret target fingerprint has been checked against the production fingerprint.

```bash
pnpm type-check
pnpm lint
pnpm test
VERCEL_ENV=preview pnpm build
pnpm test:e2e
```

Release is blocked if any required command is unavailable, including `pnpm test:e2e`. Operators must not skip an unavailable gate or record it as passed.

`VERCEL_ENV=preview` ensures `migrate:prod` skips migrations. The non-production wrapper must make a production `DATABASE_URI` unavailable to the build process in CI and local use. Record each result.

## Production-status wrapper contract

The release owner must supply the organization-approved production-secret-manager wrapper before release work begins. The wrapper is not a repository command and must inject the selected production `DATABASE_URI` into its child process without putting it on a command line, in shell history, or in a local `.env` file. It must run from a clean environment and return a non-secret fingerprint identifying the selected project, cluster, and database.

Use that exact wrapper invocation, with `pnpm migrate:status` as its child command, **both before and after promotion**. Do not run bare `pnpm migrate:status`, and do not substitute a URI into a shell assignment. Record the wrapper identity/version, pending-migration result, and target fingerprint each time; the pre- and post-promotion fingerprints must match. If no approved wrapper is available, the release is blocked.

## Confirm pending migrations and recovery evidence

Run the production-status wrapper before promotion and record its pending migration names and target fingerprint. For each pending migration, review its entry in [`src/migrations/recovery/index.ts`](../../src/migrations/recovery/index.ts).

For `20260826_211000_normalize_recurring_food`, record read-only counts for normalized schedules and exclusions and investigate duplicate-key errors before retrying. A retry is eligible only when both counts are at or below the migration's 10,000-row prefetch limit and no duplicate-key state remains unresolved; otherwise use a reviewed roll-forward procedure.

For `20260826_212000_add_payload_jobs_indexes`, use a read-only index inspection. Confirm all of the following exact source-defined specifications before retrying or marking verification complete:

| Index | Key specification, in order | Options |
| --- | --- | --- |
| `payload_jobs_runnable` | `{ queue: 1, processing: 1, hasError: 1, completedAt: 1, waitUntil: 1, createdAt: 1 }` | `{ name: 'payload_jobs_runnable' }` |
| `payload_jobs_schedule_dedupe` | `{ taskSlug: 1, queue: 1, completedAt: 1, createdAt: 1 }` | `{ name: 'payload_jobs_schedule_dedupe' }` |

Do not manually invoke a maintenance cron to prove these indexes. Observe the next normally scheduled maintenance run through the approved operational surface and record its outcome.

## Failed Google Sheets field removal decision

If a build fails after `20260830_100000_drop_google_sheets_fields` unsets the fields, the still-live prior deployment's Google Sheets endpoint can no longer import location events, food, or hours from configured URLs, and menu sync uses only its environment fallback. The release owner must immediately choose and record one of two paths: deploy a compatible roll-forward that removes the prior endpoint from live traffic, or perform an Atlas restore under the isolated-target and write-reconciliation controls below. Do not leave the prior deployment serving with degraded sync while awaiting a later release.

## Normalization verification invariants

Use read-only source and normalized-data inspection; record expected and actual values in the release record.

- **Beer reviews:** Expected count is the number of distinct legacy review source URLs for reviews with both a URL and text. Each normalized document must retain the corresponding legacy beer association. Enumerate every skipped legacy review with beer ID, array position, and reason (missing URL or text), and enumerate every URL associated with more than one beer as a conflict requiring resolution before pass.
- **Recurring food schedules:** Form the candidate set from every populated legacy `(location, day, occurrence)` slot. The actual count of normalized records matching that set must equal the count of distinct candidate keys. Enumerate any duplicate candidate key, absent normalized key, and pre-existing normalized match.
- **Recurring food exclusions:** Form the candidate set from every legacy `(location, date)` where `date.split('T')[0]` matches `YYYY-MM-DD`. The actual count of normalized records matching that set must equal the count of distinct candidate keys. Enumerate every invalid date, duplicate candidate key, absent normalized key, and pre-existing normalized match.
- **Completion marker:** Confirm the recurring-food global `normalizedAt` is set only after both schedule and exclusion invariants pass.

## Backup verification and Atlas restore controls

Before promotion, confirm and record all of the following:

- The selected database has a restorable Atlas recovery point from before the release begins.
- The recovery-point ID and timestamp are captured in the release record.
- The restore owner has confirmed access and the approved isolated-target restore procedure.
- The release owner has reviewed the pending migrations' compatibility, retry, mode, and verification evidence in [`src/migrations/recovery/index.ts`](../../src/migrations/recovery/index.ts).

Atlas restore always starts into an isolated target for validation; do not replace or cut over production directly from a recovery point. Before any production replacement or cutover, the release owner must record the recovery-point-to-cutover time gap, quiesce writes, preserve post-recovery-point writes, and reconcile them into the validated restored state. If preservation or reconciliation is not feasible, the owner with data-loss authority must explicitly approve the defined loss before cutover. Record the quiescence time, preservation location/reference, reconciliation outcome or loss approval, and the isolated and production target fingerprints.

## Vercel promotion and post-deploy checks

1. Merge the approved commit and identify the Vercel production deployment created by auto-deploy.
2. Confirm the build outcome. If it fails after migrations begin, treat the database as potentially partially mutated and use the failure table before retrying.
3. After promotion, verify `/api/health` returns its expected healthy response. The GitHub README health badge polls the same production URL through Shields.io and can lag by several minutes.
4. Open the public routes relevant to the release and confirm they render and fetch data successfully.
5. Complete an admin login with an authorized account and confirm the affected admin surfaces load.
6. Run the same production-status wrapper used before promotion and confirm no intended migration remains pending and its target fingerprint matches the pre-promotion result.
7. Confirm scheduled cron activity is visible through the approved operational surface and investigate any missed or failing job.
8. Inspect Sentry for new release-related errors and record the result.

## Failure decision table

| Condition | Decision | Required evidence and action |
| --- | --- | --- |
| A manifest entry permits retry and all of its stated preconditions hold | Retry | Preserve the build and migration error, run the production-status wrapper, record its target fingerprint, and retry only through the approved production release path. Verify using the manifest evidence. |
| A pending migration partially failed and is not recorded in the migration ledger | Targeted cleanup, then resume | Use a separately reviewed targeted cleanup or controlled procedure that makes the immutable `up()` safely complete. Capture the error, target fingerprint, and ledger evidence that the failed migration is unrecorded; only then resume the normal runner. A later normal forward migration cannot run first. |
| A failed migration is recorded, or a separately controlled procedure has explicit ledger evidence that it no longer blocks the runner | Forward migration | Prepare an explicitly reviewed forward migration compatible with the observed state. A later normal forward migration is permitted only after that ledger evidence exists; otherwise it requires separately controlled execution with ledger evidence. Do not invoke `migrate:down` or recreate removed schema or indexes contrary to the manifest. |
| A migration is `restore` and compatibility cannot be recovered by rolling forward | Atlas restore | Obtain release-owner authorization, restore to an isolated target, validate it, then satisfy the write-quiescence, preservation/reconciliation, or explicit-loss-approval controls before any cutover. |
| Considering a Payload batch down operation | Not authorized by this runbook | Capture the exact latest applied batch and obtain a separate reviewed procedure proving every migration in that batch has a safe, applicable down path and all guards pass. This runbook supplies no `migrate:down` command. |

## Release record template

Copy this template into the approved release-tracking system; do not commit completed production evidence to this repository.

```text
Release commit:
Release owner / escalation contact:
Production-status wrapper identity/version:
Selected database target fingerprint before promotion:
Pending migration names before promotion:
Migration recovery modes and evidence reviewed:
Migration ledger evidence for recovery decision:
Google Sheets failed-build decision and time:
Normalization expected/actual counts and skipped-key evidence:
Payload-jobs index inspection result:
Next scheduled maintenance-run observation:
Atlas recovery-point ID:
Atlas recovery-point timestamp:
Restore authorization owner:
Restore execution owner:
Isolated restore target fingerprint:
Recovery-point-to-cutover gap:
Writes quiesced at:
Post-recovery-point write preservation reference:
Reconciliation result or explicit data-loss approval:
Vercel production deployment:
Build result:
Post-deploy /api/health result:
Public-route result:
Admin-login result:
Migration-status result and target fingerprint after promotion:
Cron-visibility result:
Sentry result:
Rollback decision (retry / roll forward / Atlas restore / none):
Decision evidence and approver:
```
