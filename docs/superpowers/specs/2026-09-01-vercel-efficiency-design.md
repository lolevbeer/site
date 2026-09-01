# Vercel Efficiency Remediation Design

This design defines the site-only remediation for the Vercel usage audit covering August 24–31, 2026. It preserves the existing product behavior while reducing avoidable build, media, cache, serialization, polling, and runtime work.

## Scope

This effort covers:

- the `site` repository;
- the Vercel `lolev/site` project;
- automatic preview deployment policy;
- Payload media derivative selection;
- Next.js image delivery for fixed and responsive images;
- homepage and menu cache behavior;
- menu and event polling behavior;
- homepage Server Component serialization;
- documentation and operational verification.

The `lolev-manager` project and repositories are explicitly excluded by user decision.

## Baseline

The billing export contains eight observed usage days, August 24–31. Later rows contain only fixed Pro-plan accrual.

| Metric | Eight-day baseline |
|---|---:|
| Build CPU | 2,512 CPU-minutes / $1.7445 |
| Deployments | 141 total: 136 preview, 5 production |
| Fast Origin Transfer — site | 23.72 GB / $1.4234 |
| Blob Data Transfer | 21.02 GB / $1.0510 |
| Image transformations | 23,155 / $1.2028 |
| Image cache writes | 107,075 units / $0.4283 |
| ISR writes | 229,139 units / $0.9166 |
| Site Function invocations | 209,008 / $0.1254 |
| Site Fluid CPU and memory | $0.8586 |
| Homepage response size | 447,904 bytes, identity encoding |

The current media collection contains 518 documents. Average stored sizes are approximately 1.99 MB for originals, 4.7 KB for thumbnails, 28.3 KB for card derivatives, and 72.4 KB for detail derivatives.

## Constraints and Invariants

1. CMS edits must remain visible without waiting for the one-hour fallback interval. Existing tag and path invalidation remains authoritative.
2. Menu and event displays may be at most 30 seconds behind the **shared CDN response** after an update. That is not a 30-second CMS-write-to-pixel SLO; see [CMS-write-to-display freshness](#cms-write-to-display-freshness).
3. Location filtering, marketing-copy generation, JSON-LD output, theme switching, and deploy-change detection must remain functional.
4. Hero and landscape images remain responsive Next.js images. Existing square Payload derivatives must not be substituted where their crop changes the intended composition.
5. Fixed 64 px and 96 px images may bypass Vercel Image Optimization only after measured browser verification shows acceptable quality and transfer behavior.
6. Missing generated derivatives must fall back to the original media URL.
7. No database schema migration or media backfill is introduced.
8. No Cache Components, SSE, WebSocket, or custom image-service migration is introduced.
9. PR #191 (`a9a86a56`, simplify site components and display colors) has landed. This branch is rebased onto that commit. Implementation uses the post-#191 contracts: `seededLightColors` in `live-menu.tsx` / `live-events.tsx`, current `next.config.mjs` image qualities, and current `vercel.json`. Deployment policy stays out of `vercel.json`.
10. Production-only automatic builds are configured only after the implementation preview has been verified.
11. Dark-mode color cycling on live menu and event displays stays a ~30 second wall-clock cycle after poll intervals change. Today that cycle is derived from `pollCount` (`pollCount / 15` at a 2s menu interval, `pollCount / 6` at a 5s events interval). Implementation must retarget the seed to elapsed time so slowing the poll does not stretch the visual cycle.

## Resolved contracts

These were left open in the first design review. They are now the implementation contract.

### CMS-write-to-display freshness

Four layers sit between a Payload save and a kiosk pixel:

| Layer | Current | Proposed | What invalidates it |
|---|---|---|---|
| 1. Mongo / Payload | source of truth | unchanged | the write itself |
| 2. Next data cache (`unstable_cache`) | `getMenuByUrl` revalidate 60s, tags `menus` + `menu-${url}`; events helpers already tag-cached with no extra route wrapper | menu fallback 3,600s; **remove** the nested `unstable_cache` in `menu-stream` | `revalidateTag` / `revalidatePath` from `src/plugins/revalidation-plugin.ts` and `revalidateMenusForBeer` |
| 3. HTTP CDN (`Cache-Control` on the stream routes) | `s-maxage=10, stale-while-revalidate=30` | `public, max-age=0, s-maxage=30, stale-while-revalidate=60` | time. Tag invalidation does **not** purge this object |
| 4. Client poll | menu 2s / events 5s, `fetch(..., { cache: 'no-store' })`, adaptive slowdown to 5× | see [Polling state machine](#polling-state-machine) | the next poll after layer 3 has a new body |

`revalidateTag` / `revalidatePath` make layer 2 fresh immediately. Layer 3 is an independent edge object. After a CMS write the first request that is allowed to miss or revalidate layer 3 (at `s-maxage`, 30s) rebuilds from layer 2 and publishes a new shared body. Constraint 2 then allows one more poll interval (30s idle) before every display must show that body.

End-to-end budget:

- CMS write → shared CDN body: ≤ 30s (`s-maxage`)
- shared CDN body → display: ≤ 30s (idle poll)
- CMS write → display: ≤ 60s

On-demand tags remain the only way past the one-hour data-cache fallback. No extra scheduled regeneration is added. If a tag hook is skipped (`context.skipRevalidate`), behavior stays as today.

`warm` is derived from the **content** timestamp (max of menu `updatedAt` and populated item `updatedAt`; for events, max of returned event `updatedAt` values), not from a cache-write `_fetchedAt`. `warm === true` when `now - contentTimestamp < 60_000`. That flags editor activity without coupling to nested cache writes. Events-stream currently returns no `warm` field; implementation adds the same derivation.

### Polling state machine

Export a pure `selectPollInterval({ noChangeCount, warm, consecutiveErrors, hidden })` from `lib/hooks/use-polling.ts` (or a sibling module) and unit-test it. Return `null` when `hidden` is true (do not schedule); otherwise return the next delay in milliseconds. The hook becomes a thin timer around that function. Menu and event callers use the same constants — they no longer pass a custom `pollInterval`.

Constants:

| Name | Value | Role |
|---|---:|---|
| `FAST_INTERVAL_MS` | 10_000 | warm / first successful poll / content or deploy change |
| `IDLE_INTERVAL_MS` | 30_000 | steady unchanged display; matches `s-maxage` |
| `WARM_WINDOW_MS` | 60_000 | content-timestamp window for `warm` |
| `ERROR_BACKOFF_MS` | 30_000, 60_000, 120_000 | consecutive error 1 / 2 / ≥3 |
| `ERROR_BACKOFF_CAP_MS` | 120_000 | never slower than this on error |

Transitions:

| State | Condition | Next delay |
|---|---|---:|
| initial | mount, or `document` becomes visible | poll immediately, then `FAST_INTERVAL_MS` |
| fast | `warm` or timestamp/deploy-id change or `noChangeCount === 0` | 10_000 |
| idle | `noChangeCount >= 1` and not `warm` | 30_000 |
| error-1 | first consecutive failure | 30_000 |
| error-2 | second consecutive failure | 60_000 |
| error-3 | third or later consecutive failure | 120_000 |
| hidden | `document.hidden === true` | do not schedule; clear the timer |
| visible | `visibilitychange` to visible | poll immediately, reset to fast |

There is **no** third idle slowdown. Today's `SLOW_AFTER` / `SLOWER_AFTER` multipliers (2.5× / 5×) would push idle past 30s once the base interval is 30s, which violates constraint 2.

Callers:

- `live-menu.tsx`: pass no override; the hook defaults to this machine (today `pollInterval: 2000`)
- `live-events.tsx`: same machine (today `pollInterval: 5000`)
- `fetch` drops `{ cache: 'no-store' }` only after the measurement in [Route-level measurements](#route-level-measurements) shows that `no-store` is what bypasses the edge. If that measurement shows edge HITs already, still drop `no-store` so the 30s CDN object is shareable; do not add a browser `max-age=2` (the audit-remediation draft) because it fights the 30s alignment.

Success resets error count. Content timestamp change or `warm` resets `noChangeCount`. Deploy-id change still reloads the page.

### Route-level measurements

Vercel billing is project-wide. Engineering telemetry is per-URL. Capture both before changing cache or images, and recapture after.

For each URL, record `status`, `cache-control`, `age`, `x-vercel-cache`, `content-length`, `content-encoding`, `x-vercel-id`, and wall time. Hit each URL at T+0, T+5s, and T+35s, once with default headers and once with `Cache-Control: no-cache`.

Required URLs (production `https://lolev.beer` unless noted):

- `/`
- one draft and one cans `/m/{url}`
- one `/e/{location}`
- `/api/menu-stream/{url}` for that draft menu
- `/api/events-stream/{location}` for that location
- one `/_next/image?url=...` request that today represents a 64 px or 96 px render
- the same image's Payload derivative URL when one exists

Also snapshot Vercel Observability → Functions filtered by path for invocation counts on the two stream routes and `/`. These are not dollars; the eight-day billing export remains the money source of truth.

Store the capture in the implementation PR (a short markdown table is enough). Do not change poll `fetch` cache mode until this table exists.

### Compressed transfer and ISR-write metrics

Homepage 447,904 bytes was measured with `Content-Encoding: identity`. The 225 KB target is the **decoded** HTML/RSC payload, not a gzip size. After each relevant change record both:

- decoded bytes (`content-length` when identity, or decompressed body length)
- encoded bytes and `content-encoding` (`gzip` / `br` / `identity`)

If edge compression is already on, still report decoded bytes against 225 KB. If the decoded payload cannot get under 225 KB without dropping product content, the verification report names the remaining measured source (JSON-LD, location cards, beer arrays, etc.) and stops. Compression is not a substitute for shrinking the serialized view models.

ISR writes are project-wide in the billing export. Approximate the homepage contribution as:

- time-based: `revalidate = 300` → `3600` (about 12× fewer scheduled regenerations)
- on-demand: unchanged `revalidatePath('/')` from `COLLECTION_PATHS` / globals in `revalidation-plugin.ts`

Count `revalidate` exports and `revalidatePath`/`revalidateTag` call sites in the implementation PR. After landing, compare the next equivalent eight-day **ISR Writes** line to 229,139. There is no supported per-route ISR dollar split; do not invent one.

### Explicit-preview operator workflow

Apply this **after** the implementation preview has been verified (constraint 10). Do not put it in `vercel.json`.

1. Read the production branch from the Vercel project (Settings → Environments → Production → Branch Tracking). Do not assume `main`.
2. Set Ignored Build Step to the Dashboard preset **Only build production** (continues the build when `VERCEL_ENV` is `production`; skips otherwise). Exit-code convention: `1` continues, `0` skips.
3. Explicit preview, either:
   - Dashboard: Deployments → ⋮ on the git SHA → **Redeploy** → uncheck **Use project's Ignore Build Step**; or
   - CLI from a clean checkout of the branch: `pnpm dlx vercel deploy` (CLI deploys are not Git-triggered, so Ignored Build Step does not apply).
4. Do not use a `[preview]` commit marker and do not add `git.deploymentEnabled` in this effort.

Vercel still creates a CANCELED Git deployment when Ignored Build Step skips; those count toward deployment quotas and concurrent build slots but must not run the Next.js compile. Success is: production branch still builds, a normal non-production push is CANCELED in Activity, Build CPU-minutes fall, and an explicit Redeploy/CLI preview still produces a reachable URL.

Document the Redeploy checkbox and the CLI command in README when the setting is applied.

## Design

### 1. Deployment Policy

Follow [Explicit-preview operator workflow](#explicit-preview-operator-workflow). The setting stays in the Vercel project, not `vercel.json`, so it does not collide with source changes from #191.

Acceptance conditions:

- the production branch still deploys automatically;
- a normal non-production commit is reported as skipped / CANCELED;
- README explains Redeploy-with-ignore-unchecked and `pnpm dlx vercel deploy`;
- no build-machine size change is made.

### 2. Media Source Selection

`getMediaUrl` in `lib/utils/media-utils.ts` already accepts `thumbnail` | `card` | `detail` and falls back to the original URL. Most callers still omit the size, so 64 px / 96 px renders request the original (~2 MB) and then Vercel Image Optimization. Implementation converts remaining callers and adds tests; it does not redesign the helper.

Callers select sources by rendered role:

- 64 px and 96 px logos/cans: `thumbnail`;
- card and grid imagery: `card`;
- modal and detail imagery: `detail`;
- full-bleed hero and landscape location imagery: original unless a compatible existing derivative is available.

Fixed small WebP derivatives are tested in two delivery modes:

1. derivative source through Next.js Image Optimization;
2. derivative source with `unoptimized` delivery.

Only the measured winner is retained. Responsive hero and detail images stay optimized.

Acceptance conditions:

- helper tests cover each derivative, missing derivative fallback, non-image media, and string media references;
- no 64 px or 96 px rendered image requests a multi-megabyte original when a thumbnail exists;
- browser screenshots show no crop, transparency, or aspect-ratio regression;
- mobile and desktop resource logs confirm the expected derivative URLs.

### 3. Menu Cache Contract

`getMenuByUrl` remains the only cross-request data cache for a menu URL. Its fallback revalidation changes from 60 seconds to 3,600 seconds while preserving `menus` and `menu-${url}` tags.

The menu polling route removes its nested `unstable_cache` (the one that stamps `_fetchedAt`). The response timestamp remains the maximum of the menu document and populated item timestamps. `warm` follows the content-timestamp rule above.

Events-stream already has no nested cache; it only gains `warm` plus the shared `Cache-Control`.

The shared response policy for both stream routes becomes:

```text
Cache-Control: public, max-age=0, s-maxage=30, stale-while-revalidate=60
```

Acceptance conditions:

- a content timestamp within `WARM_WINDOW_MS` produces `warm: true`;
- older content produces `warm: false`;
- item timestamps can supersede the menu timestamp;
- the menu route uses one tagged data-cache layer (`getMenuByUrl` only);
- missing menus and errors retain their current status contracts;
- on-demand invalidation tests cover the existing menu tags.

### 4. Homepage ISR Contract

The homepage fallback revalidation changes from 300 seconds to 3,600 seconds. Existing collection hooks continue invalidating `/` immediately for relevant CMS writes (`COLLECTION_PATHS` and global `revalidatePath('/')`).

Acceptance conditions:

- the route exports `revalidate = 3600`;
- hook tests prove relevant collection changes still invalidate `/`;
- no additional scheduled regeneration mechanism is added.

### 5. Polling Contract

Implement [Polling state machine](#polling-state-machine). Idle menu and event displays poll every 30 seconds. Recent editor activity (`warm` or a timestamp change) uses 10 seconds. Hidden tabs do not poll.

Acceptance conditions:

- idle menu and event displays poll no faster than every 30 seconds and no slower;
- recent editor activity still selects `FAST_INTERVAL_MS`;
- a timestamp or deploy ID change still refreshes local state (deploy ID reloads);
- timer cleanup on unmount remains;
- visibility pause/resume is added and tested;
- dark-mode color cycling remains ~30s wall-clock (constraint 11).

### 6. Homepage Serialization

`components/home/home-content.tsx` becomes a Server Component. Client leaves receive explicit view-model types rather than full generated Payload collection types.

Projection functions live with homepage data aggregation and produce the minimum fields required by:

- hero beers and cans membership;
- featured draft and packaged menus;
- marketing text;
- upcoming food and events;
- coming-soon beers;
- location cards and weekly hours;
- quick-info counts;
- JSON-LD generation.

Server-only schema generation may continue using complete server data where required; complete records are not passed through client boundaries solely for that purpose. Location filtering stays a client leaf with a minimal location view model.

Acceptance conditions:

- projection tests assert the exact output shape and exclude unrelated Payload metadata;
- every client component consumes a named minimal type;
- homepage location filtering and marketing output are behaviorally unchanged;
- rendered JSON-LD remains semantically equivalent;
- the live identity-encoded (decoded) homepage response is below 225 KB, or the final report identifies the remaining measured source if that threshold is not achievable without changing product content.

## Testing Strategy

Implementation follows red-green-refactor for every observable contract:

1. media URL selection tests;
2. menu timestamp, warm-state, and cache-policy tests;
3. polling interval-state tests, including hidden/visible and error backoff;
4. homepage projection tests;
5. existing invalidation tests extended for the one-hour fallback assumptions;
6. color-cycle seed tests proving a ~30s wall-clock cycle independent of poll interval.

Configuration-only Vercel policy changes are verified through project configuration and a controlled skipped preview rather than a source-code unit test.

Required repository verification:

```text
pnpm test
pnpm type-check
pnpm build
```

Baseline after rebase onto #191: 31 test files under `tests/`. Re-run `pnpm test` at the start of implementation and record the passing count in the implementation PR. The pre-rebase figure of 30 files / 189 tests is obsolete.

## Visual and Runtime Verification

Before media or payload changes:

- capture homepage desktop and mobile screenshots;
- record image `src`/`srcset`, intrinsic dimensions, transfer sizes, and response cache headers;
- record homepage decoded and encoded response size;
- record menu and event endpoint cache headers, `x-vercel-cache`, and payload sizes using the T+0 / T+5s / T+35s matrix.

After each relevant change:

- recapture the same viewport and resources;
- compare image composition and legibility;
- confirm derivative URLs and response policies;
- exercise location selection, marketing text, menu updates, event updates, theme changes, and deploy ID changes;
- confirm a hidden `/m/{url}` tab does not keep polling.

## Rollout

1. Land and deploy the code changes while automatic previews still operate.
2. Smoke-test the preview and production routes.
3. Apply the production-only automatic-build policy.
4. Verify one ordinary preview is skipped and the production branch still builds. Verify one explicit preview via Redeploy-with-ignore-unchecked.
5. Capture immediate technical metrics (route table + decoded homepage size).
6. Compare the next equivalent eight-day billing window against the baseline.

Billing success indicators:

- preview builds are limited to explicitly requested previews;
- Blob and Fast Origin bytes fall for image-heavy routes;
- fixed-size images no longer dominate transformation/cache-write growth;
- ISR writes fall without delayed CMS updates;
- Function invocations fall after the polling cache alignment.

## Documentation

The implementation updates:

- affected inline comments and TSDoc;
- README deployment instructions for explicit previews (Redeploy checkbox and CLI);
- cache-policy documentation if present;
- component and helper contracts introduced by the minimal view models;
- the final verification report with baseline and post-change measurements, including the route-level table.

## Risks and Rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Square derivative changes visible crop | Keep hero/landscape originals; verify screenshots | Revert the affected caller to original source |
| Longer cache fallback delays content | Preserve and test on-demand tags/paths | Restore the previous fallback for the affected route |
| Polling interval feels too slow | Preserve warm 10s path; browser-test update flow | Restore 10-second response cache and prior intervals |
| DTO projection omits rendered data | Exact-shape tests plus browser journeys | Restore the affected field in the view model |
| Production-only builds block needed preview | Document Redeploy-with-ignore-unchecked before policy change | Restore Dashboard Ignored Build Step to Automatic |
| Concurrent PR changes overlap components | Rebased onto #191; implement against `seededLightColors` | Resolve against the landed component contract, then rerun all gates |
| Color cycle stretches after slower polls | Wall-clock seed (constraint 11) | Restore pollCount divisor matched to the reverted interval |
| Ignored Build Step canceled deploys still consume quota | Accept canceled Git rows; success is Build CPU-minutes, not row count | If CPU-minutes do not fall, follow up with `git.deploymentEnabled` rather than rolling back code |
