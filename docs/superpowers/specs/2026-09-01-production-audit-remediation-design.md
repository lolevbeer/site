# Production Audit Remediation Design

**Date:** 2026-09-01  
**Branch:** `fix/production-audit-remediation`  
**Worktree:** `.agents/worktrees/production-audit-remediation`

## Goal

Resolve the eight actionable findings from the 2026-09-01 production audit without changing product behavior outside the affected security, release, operational, and accessibility contracts.

The result must:

- prevent authenticated users and stored content from causing arbitrary outbound requests;
- make the retained Vercel auto-deploy migration model explicit, testable, recoverable, and documented;
- run production builds and browser release checks in CI;
- expose a non-sensitive dependency health signal and fail fast on missing core server configuration;
- make the mobile navigation a conforming modal dialog;
- give both map search inputs an accessible name;
- update release, environment, and framework documentation; and
- update GitHub Actions away from deprecated Node 20 action runtimes.

## Non-goals

- Replacing Vercel Git auto-deploy with a GitHub-owned deployment pipeline.
- Adding a new secrets manager, observability vendor, or database provider.
- Refactoring unrelated Payload collections, route structure, or frontend components.
- Claiming that repository changes can prove MongoDB Atlas backup health without authorized Atlas evidence.
- Adding a Content Security Policy; the existing audit plan tracks that separately because Mapbox, Payload, and Sentry require dedicated policy work.

## Constraints and accepted residual risk

Production migrations remain part of `pnpm build` when `VERCEL_ENV=production`. This preserves the selected Vercel auto-deploy workflow and means a migration can partially mutate the database before a later migration or build step fails. Repository changes cannot eliminate that failure mode while retaining this promotion model.

The design reduces the risk by requiring backward-compatible, idempotent/resumable migrations; recording recovery metadata for every migration; verifying registry and recovery metadata in tests; and documenting backup, restore, roll-forward, ownership, and post-deploy checks. A protected pre-migration deployment pipeline would be required to eliminate the residual sequencing risk.

## Security: Untappd outbound-request boundary

### Canonical URL contract

Create one pure parser used before every Untappd beer-page fetch.

Accepted inputs:

- relative paths beginning with `/b/` and containing a beer slug and numeric beer ID;
- absolute HTTPS URLs whose hostname is exactly `untappd.com` or `www.untappd.com`, with the same `/b/` path contract.

Rejected inputs:

- non-HTTPS absolute URLs;
- usernames or passwords in the authority;
- explicit ports;
- IP literals, localhost, private-network names, deceptive subdomains, and every non-Untappd host;
- non-beer paths;
- malformed URLs.

Accepted URLs are normalized to the canonical `https://untappd.com` origin. Query strings and fragments are discarded because beer identity is the path.

### Fetch contract

- Use the canonical URL only.
- Set `redirect: 'manual'`; any redirect is a permanent failure rather than a second unvalidated request.
- Abort after 10 seconds.
- Reject a declared or streamed response body above 5 MiB before parsing.
- Preserve current retryable/permanent failure semantics for background synchronization.
- The interactive `/api/untappd?action=rating` route returns HTTP 400 for invalid URLs without calling `fetch`.

### Tests

Tests begin with failing cases for localhost, metadata IPs, private IPs, HTTP, deceptive subdomains, credentials, alternate ports, malformed paths, redirects, timeout, and oversized bodies. Existing valid relative and absolute Untappd URLs remain accepted.

## Release safety: migrations under Vercel auto-deploy

### Migration contract

Every registered migration must provide repository-visible recovery metadata:

- compatibility statement for the currently deployed application;
- retry/idempotency statement;
- recovery mode: reversible `down`, roll-forward, or database restore;
- operator verification step.

A test verifies that the migration registry and recovery manifest have the same ordered names and no missing metadata. Destructive migrations with no-op `down()` functions must explicitly use roll-forward or restore recovery.

### Operational runbook

Add a production deployment runbook covering:

1. confirm CI, production build, and browser release checks are green;
2. inspect pending Payload migrations;
3. verify an Atlas recovery point and name the release owner;
4. confirm migration backward compatibility with the currently deployed commit;
5. deploy through the existing Vercel Git integration;
6. verify migration status, `/api/health`, public routes, admin login, and Sentry after promotion;
7. on failure, choose documented roll-forward or Atlas restore based on the migration manifest;
8. record the recovery point and deployed commit in the release record.

The README must stop implying that a failed build prevents partial database mutation.

## CI and browser release gates

### GitHub Actions

Upgrade checkout, Node setup, and pnpm setup actions to their Node-24-capable major versions. Keep frozen-lockfile installation.

CI must run:

1. type-check;
2. lint;
3. Vitest;
4. production build against a disposable MongoDB service and test environment;
5. Playwright release smoke tests against the built production server.

The build and browser jobs may be separate from static checks for clear failure attribution. Superseded pull-request runs remain cancellable; `main` runs finish.

### Disposable release fixture

Add a deterministic seed script for CI-only data. It creates a test administrator and one uniquely named FAQ record used by the authenticated update/revalidation journey. It must refuse to run unless the database URI is local or explicitly marked disposable.

### Playwright journeys

- Every primary public navigation route returns a successful page with its expected heading.
- The mobile menu traps focus, closes on Escape, and restores focus to the trigger.
- `/admin` presents login when unauthenticated.
- The seeded administrator can log in.
- An authenticated update changes the seeded FAQ answer.
- The public FAQ page reflects the updated answer after revalidation.

Playwright artifacts are retained on failure only. No production credentials or production URLs are used in CI.

## Runtime health and environment validation

### Environment contract

Centralize server-only environment access without introducing a schema dependency.

Core requirements:

- `DATABASE_URI` is non-empty;
- `PAYLOAD_SECRET` is non-empty and not the documented placeholder;
- production deployments require `BLOB_READ_WRITE_TOKEN` so uploads do not fall back to ephemeral local storage.

Optional integrations remain optional but internally consistent:

- Slack signing secret and bot token must be configured together;
- cron and revalidation endpoints continue to fail closed when their secrets are absent;
- geocoding fallbacks may be absent independently;
- public Mapbox and Sentry values remain documented as client-visible configuration.

Core validation runs when the server configuration is constructed, producing a clear error naming missing variables without printing values.

### Health endpoint

Add `GET /api/health`:

- returns HTTP 200 with `{ "status": "ok" }` after a lightweight database ping;
- returns HTTP 503 with `{ "status": "unhealthy" }` on configuration or database failure;
- sets `Cache-Control: no-store`;
- exposes no hostnames, credentials, stack traces, collection contents, or provider details;
- logs the underlying server error through the existing logger/Sentry path.

Route tests mock healthy and failing dependencies. Browser smoke verifies the healthy response against the disposable production server.

## Accessibility

### Mobile navigation

Use `@radix-ui/react-dialog`, already present in the repository, as the modal behavior owner. The controlled dialog root and trigger live in the header; the mobile panel uses Radix portal, overlay, content, and an accessible title while preserving the existing Framer Motion presentation.

Radix owns:

- focus entry and containment;
- Escape dismissal;
- body interaction lock;
- return of focus to the trigger;
- `aria-modal` and dialog semantics.

Remove the custom Escape listener and body overflow mutation so two modal systems cannot conflict. Preserve navigation labels, social links, responsive visibility, and current visual layout.

### Map search

Both responsive map-search inputs receive the same explicit accessible name, `Search locations`. Placeholder text remains unchanged. Tests query each visible variant by textbox role and accessible name.

## Documentation

Update:

- README framework version to Next.js 16;
- setup and script documentation for build and browser tests;
- migration wording and link to the production runbook;
- `.env.example` to remove the obsolete Google Sheets heading and describe required versus optional production variables;
- health endpoint and monitoring expectations;
- comments and TSDoc in every modified route, utility, configuration module, and component.

New source files receive a module-level purpose comment. New operational documentation is committed with the implementation, not deferred.

## Error handling and observability

- Invalid user input returns 400 and does not reach the network.
- Upstream redirects, oversized bodies, and permanent statuses remain permanent Untappd failures.
- Timeouts, rate limits, network errors, and transient upstream failures remain retryable.
- Health failures return only a generic body while the existing logger records diagnostic context.
- CI seed protection fails closed before any write if the target is not disposable.

## Verification gates

Implementation is complete only when all of the following pass in the remediation worktree:

- targeted red/green Vitest tests for each changed contract;
- full `pnpm test`;
- `pnpm type-check`;
- `pnpm lint`;
- production `pnpm build`;
- Playwright release smoke tests against the local production server;
- browser inspection at desktop and 375 px mobile widths;
- worktree and branch re-confirmation before commits;
- clean working tree after the final commit.

## Rollout

Land as logical commits on one remediation branch:

1. Untappd outbound-request boundary;
2. environment validation and health endpoint;
3. mobile dialog and map-search accessibility;
4. migration contract and production runbook;
5. CI build/E2E gates and action upgrades;
6. documentation synchronization and final verification.

Because the branch changes CI and deployment documentation but retains Vercel auto-deploy, merge only after the new CI workflow succeeds on the pull request. After merge, verify the production health endpoint, public navigation, admin login, migration status, and Sentry before declaring the release complete.
