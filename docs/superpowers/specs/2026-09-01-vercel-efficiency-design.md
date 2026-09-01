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
2. Menu and event displays may be at most 30 seconds behind the shared CDN response after an update.
3. Location filtering, marketing-copy generation, JSON-LD output, theme switching, and deploy-change detection must remain functional.
4. Hero and landscape images remain responsive Next.js images. Existing square Payload derivatives must not be substituted where their crop changes the intended composition.
5. Fixed 64 px and 96 px images may bypass Vercel Image Optimization only after measured browser verification shows acceptable quality and transfer behavior.
6. Missing generated derivatives must fall back to the original media URL.
7. No database schema migration or media backfill is introduced.
8. No Cache Components, SSE, WebSocket, or custom image-service migration is introduced.
9. The active PR #191 overlaps live menu/event components and deployment configuration. Work remains isolated and is rebased before landing.
10. Production-only automatic builds are configured only after the implementation preview has been verified.

## Design

### 1. Deployment Policy

The Vercel project will use its Ignored Build Step setting to build the production branch automatically and skip ordinary preview branches. Explicit previews remain possible through a documented operator action.

The setting is applied through the Vercel project API or Dashboard rather than `vercel.json`, avoiding source overlap with PR #191. The actual production branch is read from the project configuration immediately before applying the setting.

Acceptance conditions:

- the production branch still deploys automatically;
- a normal non-production commit is reported as skipped;
- the operator documentation explains how to request an explicit preview;
- no build-machine size change is made.

### 2. Media Source Selection

`lib/utils/media-utils.ts` becomes the single source of truth for selecting Payload image derivatives. The helper API accepts a requested derivative (`thumbnail`, `card`, `detail`, or original) and returns the requested generated URL when present, falling back to the original URL.

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

The menu polling route removes its nested `unstable_cache`. The response timestamp remains the maximum of the menu document and populated item timestamps. The `warm` signal is derived from that content timestamp instead of an artificial `_fetchedAt` cache-write timestamp.

The shared response policy becomes:

```text
Cache-Control: public, s-maxage=30, stale-while-revalidate=60
```

Acceptance conditions:

- a recent menu or populated item timestamp produces `warm: true`;
- older content produces `warm: false`;
- item timestamps can supersede the menu timestamp;
- the route uses one tagged data-cache layer;
- missing menus and errors retain their current status contracts;
- on-demand invalidation tests cover the existing menu tags.

### 4. Homepage ISR Contract

The homepage fallback revalidation changes from 300 seconds to 3,600 seconds. Existing collection hooks continue invalidating `/` immediately for relevant CMS writes.

Acceptance conditions:

- the route exports `revalidate = 3600`;
- hook tests prove relevant collection changes still invalidate `/`;
- no additional scheduled regeneration mechanism is added.

### 5. Polling Contract

The client polling hook aligns steady-state requests with the 30-second shared-cache interval. Recent content changes may temporarily trigger a faster interval, but unchanged displays settle at 30 seconds.

The state machine is represented by pure interval-selection logic with tests for:

- initial polling;
- recent/warm content;
- first unchanged threshold;
- long-idle threshold;
- error backoff;
- reset after content or deploy changes.

Acceptance conditions:

- idle menu and event displays poll no faster than every 30 seconds;
- recent editor activity still selects the documented fast interval;
- a timestamp or deploy ID change still refreshes local state;
- timer cleanup and visibility handling remain unchanged.

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

Server-only schema generation may continue using complete server data where required; complete records are not passed through client boundaries solely for that purpose.

Acceptance conditions:

- projection tests assert the exact output shape and exclude unrelated Payload metadata;
- every client component consumes a named minimal type;
- homepage location filtering and marketing output are behaviorally unchanged;
- rendered JSON-LD remains semantically equivalent;
- the live identity-encoded homepage response is below 225 KB, or the final report identifies the remaining measured source if that threshold is not achievable without changing product content.

## Testing Strategy

Implementation follows red-green-refactor for every observable contract:

1. media URL selection tests;
2. menu timestamp, warm-state, and cache-policy tests;
3. polling interval-state tests;
4. homepage projection tests;
5. existing invalidation tests extended for the one-hour fallback assumptions.

Configuration-only Vercel policy changes are verified through project configuration and a controlled skipped preview rather than a source-code unit test.

Required repository verification:

```text
pnpm test
pnpm type-check
pnpm build
```

The current baseline is 30 passing test files and 189 passing tests.

## Visual and Runtime Verification

Before media or payload changes:

- capture homepage desktop and mobile screenshots;
- record image `src`/`srcset`, intrinsic dimensions, transfer sizes, and response cache headers;
- record homepage response size;
- record menu and event endpoint cache headers and payload sizes.

After each relevant change:

- recapture the same viewport and resources;
- compare image composition and legibility;
- confirm derivative URLs and response policies;
- exercise location selection, marketing text, menu updates, event updates, theme changes, and deploy ID changes.

## Rollout

1. Land and deploy the code changes while automatic previews still operate.
2. Smoke-test the preview and production routes.
3. Apply the production-only automatic-build policy.
4. Verify one ordinary preview is skipped and the production branch still builds.
5. Capture immediate technical metrics.
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
- README deployment instructions for explicit previews;
- cache-policy documentation if present;
- component and helper contracts introduced by the minimal view models;
- the final verification report with baseline and post-change measurements.

## Risks and Rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Square derivative changes visible crop | Keep hero/landscape originals; verify screenshots | Revert the affected caller to original source |
| Longer cache fallback delays content | Preserve and test on-demand tags/paths | Restore the previous fallback for the affected route |
| Polling interval feels too slow | Preserve warm fast-path; browser-test update flow | Restore 10-second response cache and prior intervals |
| DTO projection omits rendered data | Exact-shape tests plus browser journeys | Restore the affected field in the view model |
| Production-only builds block needed preview | Document explicit preview operation before policy change | Restore default automatic preview builds |
| Concurrent PR changes overlap components | Isolated branch and final rebase | Resolve against the landed component contract, then rerun all gates |
