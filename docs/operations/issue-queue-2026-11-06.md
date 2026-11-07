# Issue queue: November 6, 2026

Verified against `main` at `9c982269` (clean). Every open issue was traced to current code before a verdict; line numbers are from that commit. Sibling of `issue-queue-2026-10-05.md`, which covered #232–255.

## Verdicts

| #   | Title (short)                                 | Verdict                                                                                                                                                                                                                                                        | Effort        |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 314 | Slack menu publish revision check atomic      | REAL, narrow. Only overlapping `after()` callbacks race; criterion 3 (protect an intervening admin draft) is not satisfiable by a transaction because drafts write `menus_versions`, not `menus`. Re-scope that criterion.                                     | M–L           |
| 315 | SSE frame state across chunks                 | REAL, reproduced. `lib/utils/sse-parser.ts:54-55` declares `currentEvent`/`currentData` inside the loop.                                                                                                                                                       | S             |
| 316 | Beer pricing invariants on partial update     | REAL. `src/collections/Beers.ts:148` treats omitted `halfPourOnly` as false; cleared `fourPack` leaves `canSingle`.                                                                                                                                            | S             |
| 319 | Dead legacy recurring-food write branches     | REAL cleanup. Prod global has `normalizedAt` set, both branches dead.                                                                                                                                                                                          | S             |
| 320 | Coordinate-only CSV corrections               | REAL. `import-distributors-csv.ts:207` strips `location` before diffing.                                                                                                                                                                                       | S–M           |
| 321 | Revalidate after import stream cancel         | REAL. `wrote` set only after the loop (`:270`); `sse-response.ts` has no `cancel()`.                                                                                                                                                                           | S             |
| 322 | Untappd circuit breaker never recovers        | REAL. `src/utils/untappd.ts:102-110` counter has no timestamp; reset only runs on the job instance.                                                                                                                                                            | S             |
| 324 | Queued optimistic grid edits lost on recovery | REAL. `RecurringFoodGrid.tsx:727-731` refreshes inside the failing task, before queued tasks run.                                                                                                                                                              | S–M           |
| 325 | Debounce aborts explicit map search           | REAL, highest-value bug. `use-location-search.ts:133-161` never clears `searchTimeoutRef`.                                                                                                                                                                     | S             |
| 326 | Untappd list-search stale catch/finally       | REAL. `BeerListFillCell.tsx:155-158` catch/finally unguarded.                                                                                                                                                                                                  | S             |
| 327 | Stale Untappd rating response                 | REAL. The 2026-11-05 note's "compare echoed url" does **not** work (route echoes a canonical full URL, field stores a path). Use a ref of the current field value instead.                                                                                     | S             |
| 328 | Event board stale after midnight              | REAL. `live-events.tsx` memos call `getTodayEST()` with deps `[events]` only. Food refresh is a separate product question.                                                                                                                                     | S (dates)     |
| 329 | Dispose partially-initialized can scene       | REAL. `can-scene.ts:115-144` allocates renderer/env before the awaited load, no catch.                                                                                                                                                                         | S             |
| 330 | Beer-finder search below hours                | STILL APPLIES. `beer-map-content.tsx:39-88`.                                                                                                                                                                                                                   | S             |
| 334 | Task-first homepage                           | STILL APPLIES. Step 1 (reorder children in `page.tsx:131-137`) is trivial; step 2 (hero/previews) needs a product decision.                                                                                                                                    | S / L         |
| 335 | Sticky filter height on /beer                 | STILL APPLIES. `beer-page-content.tsx:230` whole filter section is sticky.                                                                                                                                                                                     | S             |
| 336 | Compact beer tiles                            | STILL APPLIES. `beer-card.tsx:71,75,95-99`; `sizes` wrong for a 2-column grid.                                                                                                                                                                                 | S             |
| 337 | Mobile footer hour tables                     | STILL APPLIES. `footer-taprooms.tsx:77-84`; schema hours come from page JSON-LD, not the footer.                                                                                                                                                               | S–M           |
| 338 | Food page: today first                        | STILL APPLIES. `food-page-client.tsx:28-70` derives no today summary.                                                                                                                                                                                          | M             |
| 339 | Recurring events behind one-offs              | STILL APPLIES. `events-page-client.tsx:109-155` renders regulars after all one-offs.                                                                                                                                                                           | S             |
| 256 | Vulnerable locked deps                        | OPEN. 31 audit findings; 27 clear by raising four floors in `pnpm-workspace.yaml:13-32`, adding `zod@4`, bumping vitest to 4.1.12. Only `deepmerge` has no fix.                                                                                                | S             |
| 258 | Production audit checklist                    | Mostly owner-manual (Vercel access, Atlas restore drill, cold trace, a11y measurement). One repo item: six-role E2E in `tests/e2e/release-smoke.spec.ts`.                                                                                                      | M (repo part) |
| 259 | CI / abuse-control hardening                  | Workflow items DONE (SHA pins, `persist-credentials`, `permissions`, dependabot, form limiter). OPEN: no CSP anywhere; `/api/ably-auth` unthrottled. Owner decision: repo Actions settings still `allowed_actions: all`, default workflow permissions `write`. | M             |

## PRs

| #                                        | Verdict                                                                                                                                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 351 claude-code-action 1.0.264 → 1.0.267 | MERGE. SHA matches tag; three version-pin commits only. CI green.                                                                                                                                                    |
| 352 pnpm/action-setup 6.1.0 → 6.1.1      | MERGE. SHA matches tag; `action.yml` untouched; our workflows pass no `version:` input. CI green.                                                                                                                    |
| 348 Hall of Fame page                    | STALE. Remote branch has the Hall of Fame commit; its worktree is reset to main with an uncommitted `/leaderboard` pivot and no Hall of Fame files left. Decide: force-push the leaderboard as the new PR, or close. |

## Plan

Each batch is one worktree off `origin/main`, failing test first per task, `tsc --noEmit` + vitest before commit. Ordered by value and dependency.

### Batch 0 — merge now (no code)

- Merge #351 and #352.

### Batch 1 — deps (closes #256)

1. `pnpm-workspace.yaml`: `undici@6 ^6.29.1`, `undici@7 ^7.30.1`, `undici@8 >=8.12.2`, `fast-uri >=4.2.3`; add `zod@4 >=4.6.6`; bump `vitest` to 4.1.12. `pnpm install` (not frozen), `pnpm audit`, full test run.
2. Optional, same PR: `glob@13 >=14.0.2`, `minimatch@10 >=11.0.1` (build-time only). Record `deepmerge` as accepted (no fix published).

### Batch 2 — one-line bug fixes (closes #315, #325, #326, #316, #322)

Independent files, one PR, one new or extended test each.

1. #315 `sse-parser.ts`: hoist the two `let`s above the loop. New `tests/int/sse-parser.int.spec.ts` with three chunkings.
2. #325 `use-location-search.ts`: `clearTimeout(searchTimeoutRef.current)` at top of `commitTypedPlace`; return `null` for superseded, toast only on `false`. Extend `tests/int/use-location-search.int.spec.ts`.
3. #326 `BeerListFillCell.tsx`: guard catch and finally with `lastQuery.current !== q`. Extend `tests/int/beer-list-fill-cell.int.spec.tsx`.
4. #316 `Beers.ts` beforeChange: `halfPourOnly ?? originalDoc?.halfPourOnly`; null `canSingle` when `fourPack` cleared. Extend `tests/int/beer-hook-identity.int.spec.ts`.
5. #322 `untappd.ts`: `circuitOpenedAt` + cooldown reset in `isCircuitOpen`; pass `failure` through `api/untappd/route.ts:202`. Extend `tests/int/untappd-url-security.int.spec.ts`.

### Batch 3 — Untappd admin fetcher (closes #327; after Batch 2 item 5)

1. `UntappdFetcher.tsx`: `urlRef` + `mountedRef`, bail after each `await` when `urlRef.current !== targetUrl`; branch on `failure` for a retryable message. New `tests/int/untappd-fetcher.int.spec.tsx`.

### Batch 4 — distributor import (closes #321, #320; same file, this order)

1. #321: `wrote = !dryRun` right after each write (`:232`, `:258`); add `cancel()` to `createSSEResponse` and no-op `send`/`close` after cancel. Extend `tests/int/import-revalidate-once.int.spec.ts`; new `tests/int/sse-response.int.spec.ts`.
2. #320: carry `csvLocation` on `EnrichedRow`; after `distributorImportPatch`, add `location` to the patch when it differs. Extend `tests/int/distributor-csv-import.int.spec.ts` (coord-only, coords+phone, blank-city-no-coords).

### Batch 5 — recurring food admin (closes #319, #324)

1. #319 `admin-data.ts:294-314, 385-400`: replace legacy branches with a throw; drop dead imports. Extend `tests/int/admin-data-auth.int.spec.ts`.
2. #324 `RecurringFoodGrid.tsx`: `refreshNeededRef` set in the catch, `refreshData` run from the queue's `finally` when idle. Extend `tests/int/recurring-food-grid.int.spec.ts`.

### Batch 6 — public-site bugs (closes #328 dates, #329)

1. #328 `live-events.tsx`: `const today = useTodayEST() ?? getTodayEST()`, pass into the three memos and their deps. Extend `tests/int/live-events-regulars.int.spec.tsx` across ET midnight. Follow-up issue for food refresh if wanted.
2. #329 `can-scene.ts`: try/catch around the `Promise.all`, dispose renderer/env/envTex, rethrow. New `tests/int/can-scene-failure.int.spec.ts` with a mocked `three`.

### Batch 7 — ordering-only UX (closes #330, #339, #334 step 1)

Three one-file moves, one order assertion each.

1. #330 `beer-map-content.tsx`: move the map slot (`:86-88`) above the taproom grid; fix intro copy.
2. #339 `events-page-client.tsx`: move the Regulars section above `ScheduleList`.
3. #334 step 1 `page.tsx`: `UpcomingFood`, `UpcomingEvents` above `FeaturedCans`.

### Batch 8 — /beer browser (closes #335, #336)

1. #335: sticky wrapper holds only search + `LocationTabs`; availability/style/series below, non-sticky.
2. #336 `beer-card.tsx`: `h-40 md:h-64`, `sizes` 50vw on mobile, show ABV, `showCta={false}` from `beer-page-content.tsx:312`; delete the prop if no caller remains.

### Batch 9 — needs an owner decision before building

- #337 footer hours: `<details>` disclosure vs link to taproom page. Then one edit in `footer-taprooms.tsx:77-84` and a mobile reorder in `footer.tsx:34`.
- #338 food page: copy for "no truck today" and how many dates to show.
- #334 step 2: hero carousel / previews. Re-run Lighthouse after.
- #314: transaction spike only; test against a disposable Mongo, not local dev (shares prod DB). Re-scope criterion 3 first.
- #259: CSP report-only (enumerate Mapbox, Sentry, Ably, Blob, Payload admin sources), throttle `/api/ably-auth`, repo Actions settings (`sha_pinning_required`, default permissions read).
- #258: schedule the owner-only items (Vercel access, Atlas restore drill, cold trace, a11y pass); repo part is six-role E2E in `release-smoke.spec.ts`.
- PR 348: leaderboard vs Hall of Fame, then force-push or close.

## Issue hygiene

- #327: correct the 2026-11-05 revision; the echoed-URL comparison is wrong.
- #314: drop or re-scope criterion 3.
- #256: add `minimatch` to the table.
