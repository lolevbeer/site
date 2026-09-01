# Production deployment runbook

## Scope and accepted risk

This runbook governs production releases that may run Payload migrations. Vercel production builds run `pnpm migrate` before the deployment is promoted. Vercel auto-deploy remains the accepted deployment model.

Migrations can mutate MongoDB before a build later fails. In that case, the prior deployment can remain live against a partially mutated database; the process is **not atomic**. Do not retry, roll back, or restore from memory. Use the recovery mode and evidence for every pending migration in [`src/migrations/recovery.ts`](../../src/migrations/recovery.ts), then record the decision below.

Do not place credentials, cluster names, recovery-point IDs, or other production evidence in this document or in source control.

## Release owner and recovery-point evidence

Before merging, name one release owner responsible for this release and record the following in the release record:

- release owner and a reachable escalation contact;
- the Atlas recovery-point ID and timestamp verified for the explicitly selected production database;
- the person authorized to request a restore and the restore owner who will execute it;
- the commit to deploy and the pending migration names from `pnpm migrate:status`.

A release is blocked if the recovery-point ID, timestamp, restore authorization, or restore owner is missing.

## Pre-merge checks

Run these commands in CI or a local checkout before merging:

```bash
pnpm type-check
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

Record each result. A production build invokes `migrate:prod`; it only runs `pnpm migrate` when `VERCEL_ENV=production`. Do not run a production build locally with production credentials merely to satisfy this checklist.

## Confirm pending migrations against the selected database

Select the intended production database through the approved secret-management process, verify its environment and target with the release owner, and then run:

```bash
DATABASE_URI="<explicitly selected production database URI>" pnpm migrate:status
```

Record the output's pending migration names in the release record. Never paste the URI into logs, issues, or this runbook. Do not run `pnpm migrate` manually as a substitute for the Vercel production build unless the release owner has approved the recovery decision.

## Backup verification

Before promotion, confirm and record all of the following:

- The selected database has a restorable Atlas recovery point from before the release begins.
- The recovery-point ID and timestamp are captured in the release record.
- The restore owner has confirmed the access and procedure needed to restore that point.
- The release owner has confirmed whether a restore would replace the selected database or be restored to an isolated target for validation first.
- The release owner has reviewed the pending migrations' compatibility, retry, mode, and verification evidence in [`src/migrations/recovery.ts`](../../src/migrations/recovery.ts).

## Vercel promotion and post-deploy checks

1. Merge the approved commit and identify the Vercel production deployment created by auto-deploy.
2. Confirm the build outcome. If it fails after migrations begin, treat the database as potentially partially mutated and use the failure table before retrying.
3. After promotion, verify `/api/health` returns its expected healthy response.
4. Open the public routes relevant to the release and confirm they render and fetch data successfully.
5. Complete an admin login with an authorized account and confirm the affected admin surfaces load.
6. Run `pnpm migrate:status` against the same explicitly selected database and confirm no intended migration remains pending.
7. Confirm scheduled cron activity is visible through the approved operational surface and investigate any missed or failing job.
8. Inspect Sentry for new release-related errors and record the result.

## Failure decision table

| Condition | Decision | Required evidence and action |
| --- | --- | --- |
| A migration has an idempotent retry path and its manifest entry supports safely rerunning the remaining work | Retry | Preserve the build and migration error, re-check the selected database with `pnpm migrate:status`, then rerun only through the approved production release path. Verify with the manifest entry. |
| The migration's `mode` is `roll-forward`, or `down` guard conditions do not hold | Roll forward | Deploy code and/or a follow-up migration that is compatible with the observed state. Do not recreate removed schema or indexes contrary to the manifest. |
| The migration's `mode` is `restore` and compatibility cannot be recovered by rolling forward | Atlas restore | Obtain release-owner authorization, restore from the recorded recovery point using the approved Atlas procedure, validate the restored state, and record the decision. |
| Considering `migrate:down` | Down only when permitted | Never run `migrate:down` unless the manifest mode is `down`, the entry's compatibility and verification conditions have been reviewed, no later migration depends on the state being removed, and the release owner explicitly approves it. |

## Release record template

Copy this template into the approved release-tracking system; do not commit completed production evidence to this repository.

```text
Release commit:
Release owner / escalation contact:
Selected database verified by:
Pending migration names before promotion:
Migration recovery modes reviewed:
Atlas recovery-point ID:
Atlas recovery-point timestamp:
Restore authorization owner:
Restore execution owner:
Vercel production deployment:
Build result:
Post-deploy /api/health result:
Public-route result:
Admin-login result:
Migration-status result:
Cron-visibility result:
Sentry result:
Rollback decision (retry / roll forward / Atlas restore / none):
Decision evidence and approver:
```
