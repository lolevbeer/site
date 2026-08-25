# Plan: Performance + Simplification — remaining work

Status doc for a three-track audit (client rendering, server/data layer, dead
code) originally run against `main` @ `72ad61fd` (2026-07-31). **Most of the
plan has landed** — this file now holds only the open items. Line anchors below
were re-verified against `main` @ `ac74e9bd` (2026-08-24); re-resolve them
anyway before editing.

## Landed (do not re-execute)

| Original tasks | Commit | PR |
|---|---|---|
| 1–3: featured-menu memoization, ColumnHeader hoist, animated-list leak | `e2c81854` | #150 |
| 5–8: dead code + deps (~1,900 lines, 10 deps — 5 direct + 5 orphaned radix) | `89f8a9b5` | #151 |
| 9: scope beer-edit invalidation to affected menus | `79669b06` | #152 |
| 10+14: FAQ revalidation wiring, query hygiene, delete `menu-by-url` route | `ffcb97c9` | #153 |
| 11: narrow menu query payload | `ca67f86c` | #154 |
| 12: de-amplify Untappd cron writes/revalidation | `6a64aded` | #155 |

## Ground rules for the executing session

1. **Preflight first.** Run `git worktree list`, `git fetch origin`,
   `gh pr list` — worktree/PR state in this doc is a snapshot, not truth.
2. Work in a fresh worktree branched from up-to-date `main`. Never on `main`.
3. After every task: `npx tsc --noEmit` and `npx vitest run` must pass
   (`tests/int/api.int.spec.ts` fails locally on missing `PAYLOAD_SECRET` —
   pre-existing, ignore it). Before any PR: `pnpm build`.

## Explicitly rejected finding — do not implement

An audit agent claimed `cache: 'no-store'` in `lib/hooks/use-polling.ts`
makes the browser send `Pragma: no-cache`, causing Vercel to bypass its CDN
cache on every poll ("largest cost line item"). **Tested against production
2026-07-31 and refuted**: requests to
`https://lolev.beer/api/menu-stream/l-draft` carrying both
`Pragma: no-cache` and `Cache-Control: no-cache` return
`x-vercel-cache: HIT` with climbing `age`. Vercel ignores client no-cache
directives for its shared cache. Do not "fix" this; if in doubt, re-run:
`curl -s -o /dev/null -D - -H "Pragma: no-cache" https://lolev.beer/api/menu-stream/l-draft | grep -iE "age|x-vercel-cache"`
(Real menu URLs are `l-draft`, `z-draft`, `l-cans`, `z-cans`, `l-other`, `z-other`.)

---

## Open task A (was Task 4) — stop `pollCount` forcing a render every tick

`lib/hooks/use-polling.ts:84,137` increments `pollCount` state on every
successful poll; `components/menu/live-menu.tsx:34` uses it only for
`colorSeed = Math.floor(pollCount / 15)` (changes ~every 30s). ~43k forced
re-renders/display/day on the 24/7 TV displays. Fix: keep the counter in a
ref; expose a derived `colorSeed` (or accept a divisor) so state only changes
when the seed does. Verify `components/events/live-events.tsx` (same hook
consumer) before changing the hook's API.
Acceptance: tsc + vitest green; a poll tick with unchanged data and
unchanged seed causes no `LiveMenu` re-render.

## Open task B (was Task 13) — stop blocking beer saves on Untappd scrapes

`src/collections/Beers.ts:139-141` awaits `fetchUntappdData` in
`beforeChange` when the URL changes — admin saves hang on untappd.com.
Move to a fire-and-forget `afterChange` (or drop in favor of the existing
interactive `UntappdFetcher`). Acceptance: saving a beer with a changed
untappd URL returns immediately; rating still arrives (eventually or via
the admin button).

## Phase 4 — structural (optional, propose before doing)

- Split `components/home/featured-menu.tsx` (the repo's churn hotspot):
  homepage sections vs fullscreen /m displays vs `convertMenuItems` +
  `MenuItem` type as a lib module.
- Split `lib/utils/payload-api.ts` along its existing `// ====` banners.
- Split `src/components/SyncViewClient.tsx` into one component per admin tool.
These are churn/readability plays, not perf. Get explicit approval first.

## Deferred / needs hardware measurement

- Can sprite-sheet memory + paint cost on the TVs (~285MB decoded textures,
  `background-position` steps() animation repaints ~120 large regions/sec on
  Tizen). Any change here (frame size, shared sprite elements,
  `content-visibility`) requires paint-trace measurement on an actual
  Samsung Frame first — per the measure-first rule, do not tune blind.
- `/m` + `/e` bare layout route group (skip Header/Footer/framer-motion,
  AuthProvider, Analytics on TV routes). Real bundle win, larger refactor.
- `usePolling` cancellation guard (latent double-poll-chain risk on effect
  re-run; currently only fires under dev StrictMode).

## Suggested session order

1. Preflight — 5 min
2. Task A and Task B — small, independent, one PR each (or shared)
3. Stop and check in with Ted before Phase 4 or anything in Deferred.
