# Plan: Local API follows access control

Branch `refactor/follow-access-control`, worktree `.claude/worktrees/follow-access`,
based on `main` @ `1b23ea80` (2026-09-26). Line anchors are from that commit —
re-resolve before editing.

## Goal

Every Payload Local API call states its identity explicitly. Calls that act for a
person (visitor, editor, Slack user) run with `overrideAccess: false` and that
person's `user`/`req`, so collection and field access rules are the single source
of truth. `overrideAccess: true` survives only in user-less system code and is
fenced by ESLint. When following access exposes a gap, widen the role's access
rather than bypassing it.

This is also Payload v4 prep: v4 flips the omitted default from `true` to `false`.

## Facts that shape the plan

1. **Deleting `overrideAccess: true` does nothing on 3.x.** Every local op
   destructures `overrideAccess = true` (`payload/dist/collections/operations/local/find.js:5`,
   `globals/operations/local/findOne.js:5`). Converted calls must write
   `overrideAccess: false` **and** pass `user` or `req`. `undefined` (e.g. the
   `...access` spread in `src/utils/recurring-food.ts`) also means `true`.
2. **Denied relationships populate as bare IDs**, and our consumers
   (`extractBeerFromMenuItem`, `components/home/upcoming-beers.tsx`) silently drop
   non-objects. Access gaps show up as *missing content*, not errors — every
   public-read task needs a rendered before/after check, not just tests.
3. Hooks call `req.payload.find(...)` **without passing `req`**, so today they run
   without the user and outside the save transaction.

## Decisions (agreed 2026-09-26)

- **No-user code keeps a fenced override.** Allowed only in the paths listed in
  Task 12; everywhere else ESLint rejects `overrideAccess: true` and rejects a
  Local API call that omits `overrideAccess`. Isolated invariants use
  `// eslint-disable-next-line no-restricted-syntax -- system: <reason>`.
- **Gaps → widen the role.**
- **A beer on a published menu or Coming Soon is public.** Draft still hides a
  beer from the catalog, sitemap, RSS, llms.txt.
- **Derived-data / invariant helpers are system code** (review sync, unique
  slug/recipe checks, beer page revalidation): keep `overrideAccess: true`, pass
  `req` for the transaction, allowlisted with a comment saying why.

## Behaviour changes to sign off (visible in the before/after check)

| Surface | Change |
|---|---|
| Public HTML/RSC payloads | Events/recurring events no longer carry `attendees`, `pointOfContact`, `email`, `phone`, `otherInfo`; food vendors lose `email`/`phone`; `site-content` loses distributor sync URLs. Nothing renders them — this closes a data leak. |
| Beer catalog, sitemap, RSS, llms.txt | Draft beers not on a menu/Coming Soon drop out (today's omitted-override reads include them). |
| Beer page reviews | Legacy `positiveReviews` JSON fallback is removed (Task 7). |
| Slack beer typeahead | Offers what the Slack user can read (bartenders: all beers after Task 2). |
| Bartenders / lead bartenders | Can read draft beers in the admin panel (Task 2). |
| Recurring food schedule global | Publicly readable (already published on `/food`). |

## Tasks

Legend: **[P]** can run in parallel with other [P] tasks in the same wave.
Validation after every task: `pnpm exec tsc --noEmit` and the named test
(`pnpm exec vitest run <file>`). Test files are under `tests/int/`.

### Wave 0 — setup

**0. Install deps in worktree.** `pnpm install` (worktree has no `node_modules`).
Acceptance: `pnpm exec tsc --noEmit` clean at base. Deps: none.

### Wave 1 — widen access rules (TDD in `access-control.int.spec.ts`)

**1. [P] RecurringFood global public read.**
File: `src/globals/RecurringFood.ts:24`. Test first in
`tests/int/access-control.int.spec.ts`: anonymous `read` → `true`.
Keep `SCHEDULE_READER_ROLES` unchanged (it gates `src/actions/admin-data.ts`).
Types: `GlobalConfig['access']`. Deps: 0.

**2. [P] `canReadBeers`: bartenders read all; others read published OR menu/Coming-Soon beers.**
File: `src/collections/Beers.ts:56`, new helper `src/access/public-beer-ids.ts`
(module comment; the only access-layer override, inline-disabled with reason).
- `admin`, `beer-manager`, `bartender`, `lead-bartender` → `true`.
- Everyone else → `{ or: [{ _status: { equals: 'published' } }, { id: { in: ids } }] }`
  where `ids` = beer IDs in `items[].product` (relationTo `beers`) of
  `_status: published` menus + `coming-soon.beers[].beer`.
- `canReadBeers` becomes async; memoize `ids` on `req.context` so one request
  (incl. depth-3 population) queries once. Anonymous public reads already sit
  inside `unstable_cache`, so the cost is per cache fill.

Tests first: bartender → `true`; anonymous → `or` clause with IDs from a mocked
`req.payload.find`/`findGlobal`; second call on same `req` does not re-query.
Types: `Access`, `Where`, `Menu`, `ComingSoon` from `src/payload-types`. Deps: 0.

### Wave 2 — convert call sites

Pattern: people → `overrideAccess: false` + `user`/`req`; system → explicit
`overrideAccess: true` (+ `req` inside hooks). Tests assert call args via the
existing mock-payload style (`payload-query-shape.int.spec.ts`).

**3. [P] Public reads in `lib/utils/payload-api.ts`.**
Lines 63, 82, 162, 201, 249, 390, 471, 557, 614, 641, 695, 728, 863, 876, 975,
1111, 1252, 1311 → `overrideAccess: false` (anonymous; no `user`). At :390 drop
the "we filter `_status` ourselves" override; keep the filter.
Test: `payload-query-shape.int.spec.ts` asserts `overrideAccess: false` on each
exported fetcher's call. Deps: 2 (menus/Coming Soon depend on the widened beer rule).

**4. [P] Other public reads.**
`src/app/(frontend)/food/page.tsx:89,101,184`, `src/app/(frontend)/e/[location]/page.tsx:52`,
`lib/jobs/payload.ts:70,92` → `overrideAccess: false`.
Test: extend `payload-query-shape.int.spec.ts` (or `jobs-page.int.spec.ts` for
`lib/jobs`). Deps: 0.

**5. [P] `src/utils/recurring-food.ts` explicit identity.**
Replace the `...access` spread (:96–139) with an explicit
`{ overrideAccess: boolean; user?: User | null }` param passed literally to each
call. Callers: `payload-api.ts:1022` and `food/page.tsx:100` → `overrideAccess: false`
(works after Task 1); `admin-data.ts:256` → `false` + `user` (already).
Test: `recurring-food-state.int.spec.ts` — anonymous caller passes `false`, no
spread. Deps: 1.

**6. [P] Hooks that act for the editor.**
`src/collections/Menus.ts:115,158`, `src/collections/Food.ts:48`,
`src/collections/Jobs.ts:22`, `src/collections/Beers.ts:25` → pass `req`,
`overrideAccess: false`.
Test: new `tests/int/hook-identity.int.spec.ts` — invoke each hook with a mock
`req` (bartender for Menus) and assert the inner call receives that `req` and
`overrideAccess: false`; Menus cans sort gets a draft beer's recipe for a
bartender (relies on Task 2). Deps: 2.

**7. [P] Beer page reviews (two calls, one change).**
`payload-api.ts:201` (Task 3 covers the flag) + `src/utils/beer-reviews.ts:177`
→ `overrideAccess: false`, and delete the legacy `positiveReviews` fallback at
`payload-api.ts:~220` (anonymous can't read that field; converting only one
call re-exposes unapproved reviews via the fallback).
**Pre-check:** add read-only `scripts/check-legacy-reviews.ts` (run via
`payload run`) listing beers with non-empty `positiveReviews` but zero
`beer-reviews` docs. The user runs it against prod; if it lists any, stop and
report before deleting the fallback.
Test: `beer-reviews.int.spec.ts` — anonymous read passes `false`; beer with only
unapproved docs yields no reviews (not the legacy JSON). Deps: 3.

**8. [P] Admin endpoints pass `user` explicitly.**
`src/endpoints/{recalculate-beer-prices,update-distributor-urls,import-distributors,
import-lake-beverage-csv,regeocode-distributors,sync-untappd-ratings}.ts` and
`lib/distributors/upsert-existing.ts:37` (add `user: User` param). Use the user
already resolved via `auth-helper.ts` (may come from `getUserFromRequest`, so
`req.user` can be null — pass `user`, not `req`).
Test: new `tests/int/endpoint-identity.int.spec.ts` asserting `overrideAccess: false`
+ resolved `user` on each endpoint's calls. Deps: 0.

**9. [P] Slack acts as the mapped user.**
`src/app/api/slack/route.ts:755,773,879,886` → `overrideAccess: false` + the
resolved Payload user. Identity bootstrap `:162,:174,:185` and the invite
duplicate-email check `:544` stay `true` with inline fenced disables (no identity
yet / lead bartenders can't read other users). Keep the `canEditMenus`
pre-check (menus read still falls through to "published" for non-editors).
Test: `slack.int.spec.ts` — typeahead and menu reads receive the user. Deps: 2.

**10. [P] System helpers keep override, gain `req`.**
`src/utils/beer-reviews.ts` (sync/prune helpers), `src/utils/revalidate-beer-page.ts`,
`src/collections/utils/generateUniqueSlug.ts`, `Beers.ts:116,132` (recipe
checks, inline disable) → explicit `overrideAccess: true`, pass `req` so they
join the save transaction.
Test: `beer-reviews.int.spec.ts`, `revalidate-beer-page.int.spec.ts` assert
`req` is forwarded. Deps: 0.

**11. [P] User-less system code: explicit `true`.**
`src/jobs/sync-untappd-ratings.ts:22,90`, `src/app/api/cron/sync-untappd/route.ts:22`
(`jobs.run`), `lib/public-forms/durable-limit.ts`, `lib/slack/notify.ts`,
`src/actions/donation-request.ts:121,137`, `src/actions/job-application.ts:77,89`,
`scripts/reset-password.ts`, `scripts/seed-e2e.ts`, migrations. Public reads
inside form intake (`donation-request.ts:81`, `job-application.ts:66`) →
`overrideAccess: false`.
Test: update `sync-untappd-batching.int.spec.ts:266-267` exact-arg assertions;
`donation-request-action.int.spec.ts` / `job-application-action.int.spec.ts`
assert the public read passes `false`. Deps: 0.

### Wave 3 — fence and verify

**12. ESLint fence.** `eslint.config.mjs`: two `no-restricted-syntax` selectors —
(a) `Property[key.name='overrideAccess'][value.value=true]`; (b) Local API
call (`payload.*` / `*.payload.*` receiver, ops find|findByID|findGlobal|count|
create|update|delete|updateGlobal|findDistinct) whose first arg object lacks an
`overrideAccess` property. (a) is off for: `src/migrations/**`, `scripts/**`,
`src/jobs/**`, `src/app/api/cron/**`, `lib/public-forms/**`, `lib/slack/notify.ts`,
`src/actions/{donation-request,job-application}.ts`, `src/utils/beer-reviews.ts`,
`src/utils/revalidate-beer-page.ts`, `src/collections/utils/generateUniqueSlug.ts`.
Test: new `tests/int/eslint-override-fence.int.spec.ts` using ESLint's
`lintText` — rejects `true` in `lib/x.ts`, allows it in `src/migrations/x.ts`,
rejects an omitted flag. Acceptance: `pnpm lint` has zero new errors.
Deps: 3–11.

**13. Rendered before/after check.** Against a dev DB copy: capture HTML of `/`,
`/[location]`, `/m/*`, `/beer`, a beer page, `/food`, `/events`, `/jobs`,
`/sitemap.xml`, `/feed.xml` on `main` and on this branch; diff visible text.
Only the sign-off table changes may appear. Admin smoke: bartender saves a cans
menu with a draft beer (sort correct); event-manager opens recurring food grid.
Deps: 12.

**14. Docs + final gate.** Add an "Access control" section to `AGENTS.md`
(identity rule, fence list, why omitted-override is linted, v4 note); update
stale comments at touched sites. Then `pnpm exec tsc --noEmit`, `pnpm test`,
`pnpm lint`, `pnpm build`. Deps: 13.

## Parallelism

- Wave 1: 1 ∥ 2.
- Wave 2: 4, 8, 10, 11 can start after 0; 3, 6, 9 after 2; 5 after 1; 7 after 3.
  Files are disjoint except `payload-api.ts` (3, 5, 7) → one agent owns the
  `payload-api.ts` edits of 3 → 7 → 5 in sequence.
- Wave 3 sequential.

## No database migrations

Access rules are code-only. No schema change.

## Out of scope

- Payload v4 upgrade itself (codemod, `storage` key, TS 6, `defaultDepth`, `versions: false`).
- Service-account users (rejected in favour of the fenced override).
