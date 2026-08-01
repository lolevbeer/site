# Plan: Performance + Simplification Findings (repo audit 2026-07-31)

Execution plan for the findings of a three-track audit (client rendering,
server/data layer, dead code) run against `main` @ `72ad61fd`. Written for a
fresh session with no prior context — everything needed is in this file.

## Ground rules for the executing session

1. **Preflight first.** Run `git worktree list`, `git fetch origin`,
   `gh pr list`. At audit time these worktrees held relevant work — re-check
   they still do before assuming:
   - `.claude/worktrees/ux-tweaks` (`fix/menu-display-theme-jitter`) —
     **11 uncommitted files** including `components/menu/live-menu.tsx`,
     `components/beer/draft-beer-card.tsx`, `components/beer/beer-details.tsx`,
     `src/collections/Beers.ts`. **Do not edit these files** while that
     worktree is dirty; tasks touching them are marked ⚠ below.
   - `.claude/worktrees/vercel-cost-opt` (`perf/vercel-cost-opt`) —
     uncommitted changes to `next.config.mjs` (image `minimumCacheTTL`,
     `qualities`) and the ISR `revalidate` windows in
     `src/app/api/menu-stream/[url]/route.ts` and
     `src/app/api/events-stream/[location]/route.ts`. **Those levers are
     owned there — out of scope for this plan.**
2. Work in a fresh worktree branched from up-to-date `main`
   (e.g. `git worktree add .claude/worktrees/perf-fixes -b perf/audit-fixes origin/main`).
   Never on `main` directly.
3. After every task: `npx tsc --noEmit` and `npx vitest run` must pass
   (`tests/int/api.int.spec.ts` fails locally on missing `PAYLOAD_SECRET` —
   pre-existing, ignore it). Before any PR: `pnpm build`.
4. One commit per numbered task (or per phase for the deletion tasks).
   Docs updates ride in the same commit as the change.

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

## Verification status legend

- **[V]** — verified directly during the audit (code read or live-tested).
  Safe to implement as described.
- **[A]** — agent finding, plausible but not independently confirmed.
  Re-verify the claim (read the cited lines, check callers) before changing.

---

## Phase 1 — TV display render fixes (highest impact, smallest diff)

Context: `/m/[menuUrl]` pages run 24/7 on Samsung Frame TVs, polling every
2s via `lib/hooks/use-menu-stream` → `lib/hooks/use-polling`. Steady-state
render cost and slow leaks matter more here than anywhere else.

**Task 1 [V] — restore memoization: hoist the `menus` default.**
`components/home/featured-menu.tsx:509` has `menus = []` as a default
parameter — a fresh array identity every render, which defeats the
`allItems` → `filteredItems` → `displayItems` memo chain (lines 523–534),
rebuilds every item object via `convertMenuItems` each 2s tick, and makes
`DraftBeerCard`'s `React.memo` never hit (fresh `beer` prop identity). On
`/m/*`, `menus` is never passed, so this fires on every render.
Fix: module-scope `const NO_MENUS: Menu[] = []`, use as the default. Also
split `displayItems` so the `menu` branch doesn't depend on `filteredItems`.
Acceptance: with React DevTools profiler (or a temporary render counter),
`DraftBeerCard` does NOT re-render on a poll tick when menu data is
unchanged. tsc + vitest green.

**Task 2 [V] — hoist `ColumnHeader` out of the render body.**
`components/home/featured-menu.tsx:597` declares `ColumnHeader` inside an
IIFE in JSX; new component type each render → both column headers unmount
and remount every tick. Hoist to module scope as
`function ColumnHeader({ isOtherMenu }: { isOtherMenu: boolean })`.
(Same bug class was fixed in `draft-beer-card.tsx` — see the comment there.)
Acceptance: tsc green; headers no longer remount in profiler.

**Task 3 [V] — fix the stranded-exiting-items leak.**
`lib/hooks/use-animated-list.ts:178-186`: the effect cleanup clears ALL
pending timeouts and runs on every `currentKeysString` change. If keys
change twice within `exitDuration` (500ms), an exiting item's removal
timeout is cleared, never rescheduled (`prevKeysRef` already advanced), and
the item is preserved forever by the `isStillExiting` branch (line ~122) —
an invisible (`opacity: 0`) but live card subtree per occurrence, forever.
Fix: move timeout teardown to its own unmount-only effect
(`useEffect(() => () => { … }, [])`); remove the cleanup return from the
keys-change effect.
Acceptance: add a vitest case (jsdom + fake timers): render hook, remove
key A, advance 200ms, remove key B, advance 1s → A is gone from the
returned list. Must fail before the fix, pass after.

**Task 4 [A] ⚠ — stop `pollCount` forcing a render every tick.**
`lib/hooks/use-polling.ts:137` increments `pollCount` state on every
successful poll; `components/menu/live-menu.tsx:34` uses it only for
`colorSeed = Math.floor(pollCount / 15)` (changes ~every 30s). ~43k forced
re-renders/display/day. Fix: keep the counter in a ref; expose a derived
`colorSeed` (or accept a divisor) so state only changes when the seed does.
⚠ `live-menu.tsx` is dirty in the ux-tweaks worktree — **do this task only
if that worktree has landed or been cleaned**; otherwise defer it and note
so in the PR. Also verify `components/events/live-events.tsx` (same hook
consumer) before changing the hook's API.
Acceptance: tsc + vitest green; a poll tick with unchanged data and
unchanged seed causes no `LiveMenu` re-render.

Phase 1 exit: single PR titled `perf(menu): eliminate steady-state render
work on /m displays`. Manual smoke: open `/m/l-draft` locally, confirm
items render, animate on a menu edit, and theme switches still work.

## Phase 2 — dead code deletion (~1,900 lines, 5+ deps)

All items below were reported by the dead-code agent, which verified by
grep including Payload's `importMap.js` string references. **Re-verify each
before deleting** (`grep -rn "<name>" src lib components tests scripts`) —
treat every deletion as [A] except monaco which is [V].

**Task 5 — delete unused dependencies.**
`monaco-editor`, `@monaco-editor/react` [V — zero references anywhere],
`zod`, `@vercel/blob` (dev). `pnpm remove …`, then
full `pnpm build` to prove nothing broke.
Do NOT remove: `@svgr/webpack` (next.config.mjs:90), `date-fns`
(peer of date-fns-tz), `@types/randomcolor`, `@types/geojson` — the last
looks unused but mapbox-gl's `GeoJSONFeature` resolves against its ambient
types; removing it breaks the Vercel type-check in
`components/ui/distributor-map.tsx` while local tsc still passes via
`skipLibCheck` (learned the hard way: removed in PR #151, restored in
e2be4d0c).

**Task 6 — delete dead files.**
- `components/events/event-list.tsx` (453 lines, no importer)
- Six shadcn components: `components/ui/{dropdown-menu,sheet,popover,hover-card,switch,label}.tsx`
  (540 lines) + their now-orphaned `@radix-ui/react-*` deps
  (keep `@radix-ui/react-dialog`)
- `lib/constants/beer-filters.ts`, `src/components/admin/LargeJSONField.tsx`,
  `src/components/ViewSiteLink.tsx`, `lib/utils/auth.ts`,
  `lib/analytics/index.ts` (update `lib/analytics/README.md` examples),
  `components/beer/index.ts`
- Keep: `components/motion/index.ts`, `components/icons/index.ts`,
  `lib/types/index.ts` (live barrels), `src/app/global-error.tsx`
  (Next convention).

**Task 7 — delete dead exports in live files (~300 lines).**
Highest-value: six query functions in `lib/utils/payload-api.ts`
(`getAllStyles`, `getHolidayHours`, `getHolidayHoursForLocation`,
`getAllLocationsWeeklyHours`, `getRecurringFoodGlobal`,
`getUpcomingRecurringFood`, ~180 lines), the four forwarding wrappers in
`lib/utils/cache.ts:26-52`, the dead `COLLECTION_CACHE_MAP` copy in
`lib/utils/cache.ts` (**but first port its `faqs` entry to the live map —
Task 10**), `logger.data/api/perf/debug` in `lib/utils/logger.ts`, the
dead-EST date predicates in `lib/utils/date.ts`, plus per-file dead exports
in: `location-provider.tsx` (`withLocationProvider`, `LocationConditional`,
`LocationSpecific`, `useLocationRouting`), `location-tabs.tsx`
(`LocationTabContent`, `LocationInfoCard`), `pittsburgh-time.ts`
(`isDaytimeInPittsburgh`, `getMsUntilNextTransition`), `display-theme.ts`
(un-export `lightVars`/`darkVars`), `formatters.ts` (`partitionByDate`),
`json-ld.ts` (`generateJsonLdScript`), `payload-beers.ts`
(`getBeerByVariant`), `lib/types/beer.ts` (`getLocationAvailability`),
`error-boundary.tsx` (`SectionErrorBoundary`), `beer-card.tsx`
(`BeerCardSkeleton`), `location-card-skeleton.tsx` (`LocationCardSkeleton`),
`generateUniqueSlug.ts` (`transliterate`), `featured-menu.tsx`
(`FeaturedMenu` thin dispatcher — keep `FeaturedBeers`/`FeaturedCans`).
CAUTION: the four JSON-LD schema generators (`menu-schema`,
`local-business-schema`, `product-schema`, `speakable-schema` partials)
look like planned-SEO work — **ask the user before deleting those
specifically**; delete the rest without asking.
Framework contracts that only LOOK unused — keep: `PUT`/`PATCH`/`DELETE` in
`src/app/(payload)/api/[...slug]/route.ts`, `maxDuration` in the cron route.

**Task 8 — small consolidations.**
- `lib/utils/menu-item-utils.ts`: fold private `extractBeerIdFromMenuItem`
  into `menuItemHasBeer` via `extractProductRefFromMenuItem` (keep the
  `relationTo === 'beers'` guard).
- `components/ui/toggle.tsx`: inline `toggleVariants` into
  `toggle-group.tsx`, delete file, drop `@radix-ui/react-toggle`.
- `lib/utils/lazy-load.tsx`: move `MapLoadingSkeleton` next to
  `components/map/location-card-skeleton.tsx`, delete file.

Phase 2 exit: one PR `chore: remove ~1,900 lines of dead code and 5 unused
deps`. Acceptance for every task: tsc, vitest, AND `pnpm build` green
(build catches Payload importMap/string-ref breakage that tsc misses).

## Phase 3 — server / data layer (re-verify each before changing)

**Task 9 [A] — scope beer-edit invalidation to affected menus.**
`src/plugins/revalidation-plugin.ts:21` maps `beers → ['beers','menus']`:
any beer edit nukes every menu's cache + `getAvailableBeersFromMenus`,
and the precise `menu-${url}` tags computed in `src/collections/Beers.ts`
never reach `getMenuByUrl` (tagged only `['menus']`,
`lib/utils/payload-api.ts:~238`). Fix: add `` `menu-${url}` `` to
`getMenuByUrl`'s tags; drop `'menus'` from the plugin's `beers` entry.
Verify first that nothing else depends on beer-edits-invalidate-all-menus.
Acceptance: existing tests green; manual: edit a beer on menu A → /m of
menu A updates within a poll, menu B's cache entry survives.

**Task 10 [A] — FAQ invalidation + map dedup.**
Add `faqs: ['faqs']` (tags) and `/faq` (paths) to the LIVE map in
`src/plugins/revalidation-plugin.ts`; delete the drifted duplicate map in
`lib/utils/cache.ts` (see Task 7). Acceptance: editing an FAQ in admin
updates `/faq` without waiting for the 1h fallback (manual check ok).

**Task 11 [A] — narrow the menu query payload.**
`getMenuByUrl`/`getMenuByUrlFresh` use `depth: 3`, shipping full Beer docs
incl. `positiveReviews` (unbounded, display never renders it) + 4 populated
Media docs per item, in every 2s poll response and every ISR write. Fix:
Payload `populate` narrowing to the fields menus render — derive the exact
list from `convertMenuItems` in `featured-menu.tsx` and
`lib/utils/payload-adapter.ts`, don't trust the audit's list blindly.
Also consolidate the byte-identical query bodies of `getMenuByUrl` /
`getMenuByUrlFresh` into one private `findMenuByUrl` — but **preserve the
divergent error semantics**: the fresh variant must keep throwing on
transient errors (its JSDoc explains the ISR-404-poisoning hazard).
Acceptance: /m renders identically (names, styles, prices, images, sprites,
ratings, badges); response body size measurably smaller; the
`fetch-error-propagation` test still green.

**Task 12 [A] — de-amplify the Untappd cron.**
`src/app/api/cron/sync-untappd/route.ts:43-99`: up to 500 sequential
`payload.update`s, each firing the full revalidation fan-out (2 tags +
3 paths) plus a menus query from `Beers.afterChange`. Fix: (a) skip the
update when rating/ratingCount/reviews are unchanged; (b) pass
`context: { skipRevalidate: true }` and honor it in the plugin +
`Beers.afterChange`, firing one batched invalidation after the loop.
Same pattern applies to the loop in `src/endpoints/sync-google-sheets.ts:785,798`.
Acceptance: dry-run the cron locally — unchanged beers produce no writes;
changed ones still update; one invalidation total.

**Task 13 [A] ⚠ — stop blocking beer saves on Untappd scrapes.**
`src/collections/Beers.ts:140-155` awaits `fetchUntappdData` in
`beforeChange` when the URL changes — admin saves hang on untappd.com.
Move to a fire-and-forget `afterChange` (or drop in favor of the existing
interactive `UntappdFetcher`). Acceptance: saving a beer with a changed
untappd URL returns immediately; rating still arrives (eventually or via
the admin button). ⚠ `Beers.ts` is dirty in ux-tweaks — same rule as Task 4.

**Task 14 [A] — cheap query hygiene (batch as one commit).**
- `lib/utils/homepage-data.ts:122-125`: events/food fetched at limit 3 AND
  10 (separate cache keys) — fetch 10 once, slice.
- `src/collections/utils/generateUniqueSlug.ts:58,65`, `Beers.ts:105,121`:
  add `depth: 0` + minimal `select` to existence/max checks; guard
  `Locations.ts` slug regen on `name` change.
- Sequential → `Promise.all`: `src/app/(frontend)/food/page.tsx:96-119`,
  `lib/utils/payload-beers.ts:15-17,34-36`.
- Delete dead route `src/app/api/menu-by-url/[url]/route.ts` (verify no
  fetches reference `menu-by-url` first — audit says only the stream
  endpoints are used).

Phase 3 exit: one PR per task 9/11/12; 10+13+14 may share a PR.

## Phase 4 — structural (optional, propose before doing)

- Split `components/home/featured-menu.tsx` (798 lines, 52 edits in last
  200 commits — the repo's churn hotspot): homepage sections vs fullscreen
  /m displays vs `convertMenuItems` + `MenuItem` type as a lib module.
- Split `lib/utils/payload-api.ts` (1,329 lines) along its existing
  `// ====` banners AFTER Task 7's deletions.
- Split `src/components/SyncViewClient.tsx` (1,207 lines) into one
  component per admin tool.
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

1. Preflight (§ground rules) — 5 min
2. Phase 1 tasks 1–3 (+4 if unblocked) — one PR
3. Phase 2 — one PR, mostly mechanical
4. Phase 3 — re-verify, then task-per-PR
5. Stop and check in with Ted before Phase 4 or anything in Deferred.
