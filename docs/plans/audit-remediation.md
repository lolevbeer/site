# Audit Remediation Plan (SEO / views / UX / efficiency — 2026-08-26)

> **For agentic workers:** execute task-by-task (subagent per task or inline
> with checkpoints). Steps use checkbox syntax for tracking. Read the
> **Findings reference** section first — every task cites finding IDs from it,
> and the plan argues from those findings.

**Goal:** Fix every actionable finding from the 2026-08-26 three-track audit
(SEO, UX/views, efficiency) in five reviewable PRs.

**Architecture:** No structural changes — each task is a targeted fix at the
altitude the finding names. Phases map 1:1 to PRs; tasks within a phase are
mostly parallel. Verify-first rules apply to anything touching rendered
output or live caching behavior (measure before and after; never tune blind).

**Tech Stack:** Next.js 15 App Router, Payload CMS 3 (MongoDB), Tailwind 4,
framer-motion, three.js, Mapbox GL, Sentry, Vercel (Fluid Compute).

**Spec:** the Findings reference at the bottom of this document (F-numbers).
Every finding was verified with file:line evidence and, where marked, live-site
measurement during the 2026-08-26 audit session.

## Ground rules

1. Branch each phase off `main` **after PR #162 (`chore/audit-gap-fixes`)
   merges** — Task 14 edits `src/app/robots.ts`, which #162 rewrote, and CI
   from #162 is what validates every task.
2. After every task: `pnpm type-check` and `pnpm test` must pass. Phases 1–2
   also require `pnpm build` green before the PR (they touch layout/data
   paths that only the build exercises).
3. One commit per task. One PR per phase. Stop for a checkpoint after each
   phase per the multi-hour-task rule.
4. Worktree: run in the main checkout unless another session is active
   (`git worktree list` first — the ux-tweaks worktree touches
   `live-menu.tsx`; Task 8 must check it is not dirty there before editing).
5. Measure-first (hard rule for Tasks 8 and 1): capture the live/rendered
   behavior BEFORE the edit, and re-capture after. Numbers go in the PR body.

---

## Phase 1 — Views: first paint & perceived speed (PR `fix/first-paint`)

### Task 1: Stop shipping `opacity: 0` in server HTML  [F-U1]

**Files:**
- Modify: `components/motion/page-transition.tsx`
- Modify: `components/motion/blur-fade.tsx`

**Interfaces:** `PageTransition` and `BlurFade` keep their exact props; only
initial-render behavior changes. No caller changes.

- [ ] **Measure before:** `curl -s https://lolev.beer/ | grep -c 'opacity:0'`
      and save an LCP number
      (`npx lighthouse https://lolev.beer --only-categories=performance`).
- [ ] In `blur-fade.tsx`, make the SSR pass render at final styles: pass
      `initial={false}` to `motion.div` until the component has mounted on
      the client, so server HTML paints visible. Concretely:

```tsx
// blur-fade.tsx — render visible on the server; animate only after mount
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])
// in the motion.div:
initial={mounted && !isInView ? 'hidden' : false}
```

      (If `page-transition.tsx` sets its own `initial="hidden"`, apply the
      same guard there. Grep `components/motion/` for `initial=` to catch
      every variant.)
- [ ] Verify in dev: view-source of `/` (not the DevTools DOM) shows the
      `<h1>` with no `opacity:0`/`filter:blur` inline style; client
      navigation between `/` and `/beer` still animates.
- [ ] `pnpm type-check && pnpm test && pnpm build`
- [ ] Commit: `fix(motion): render pages visible in server HTML, animate only on client`
- [ ] **Measure after** (same commands); numbers go in the PR body.

### Task 2: Route skeletons  [F-U2]  (parallel with 1, 3)

**Files:**
- Create: `src/app/(frontend)/beer/loading.tsx`
- Create: `src/app/(frontend)/events/loading.tsx`
- Create: `src/app/(frontend)/food/loading.tsx`
- Create: `src/app/(frontend)/beer-map/loading.tsx`

**Interfaces:** consumes `Skeleton` from `components/ui/skeleton.tsx` (exists).

- [ ] Each file: a server component returning a page-shaped skeleton. Match
      each page's container classes (copy the outermost wrapper div from the
      corresponding `page.tsx` so there is no shift when content arrives).
      Beer example:

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Skeleton className="h-10 w-48 mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-72 w-full" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] Verify: dev-server hard-navigate to `/beer` with DevTools "Slow 3G" —
      skeleton appears before content.
- [ ] `pnpm type-check && pnpm test`
- [ ] Commit: `feat(ux): add loading skeletons for beer, events, food, beer-map`

### Task 3: Unblock the page shell from footer-hours fetches  [F-U3]

**Files:**
- Modify: `src/app/(frontend)/layout.tsx:129-130` (the two serial awaits)
- Modify: `components/layout/footer.tsx` (or wherever `locations`/
  `weeklyHours` props land — trace from layout)

**Interfaces:** the footer's data fetching moves inside a new async server
component `FooterHours` (same file as footer or adjacent); `layout.tsx`
renders `<Suspense fallback={null}><FooterHours /></Suspense>` instead of
awaiting the fetches itself.

- [ ] Move `getAllLocations()` + `getWeeklyHoursForLocations(locations)` out
      of the layout body into an async server component rendered inside
      `<Suspense>`. The two calls stay sequential *inside* the suspended
      component (the second needs the first's result) — the win is that the
      shell no longer waits on them.
- [ ] Check other consumers: if the header/`ConditionalLayout` also uses
      `locations`, keep that fetch where it is and move only what the footer
      needs. (Both calls hit the Next data cache, so a second call is
      deduped, not doubled.)
- [ ] Verify: `pnpm build` output still marks frontend routes ISR (not
      dynamic); footer hours still render.
- [ ] `pnpm type-check && pnpm test && pnpm build`
- [ ] Commit: `perf(layout): stream the shell; fetch footer hours in Suspense`

### Task 4: Honest hero empty state  [F-U9]  (parallel)

**Files:**
- Modify: `components/home/hero-section.tsx:132-139`

- [ ] Replace the perpetual `"Loading available beers..."` branch: when
      `displayBeers.length === 0`, render `null` for the carousel block (the
      hero copy/CTA stays).
- [ ] `pnpm type-check && pnpm test`
- [ ] Commit: `fix(home): hide beer carousel when no beers, drop fake loading copy`

### Task 5: DB errors are errors, not 404s  [F-U10, F-S5]  (parallel)

**Files:**
- Modify: `src/app/(frontend)/beer/[variant]/page.tsx:79-88`

- [ ] Change the fetch guard: transient DB failures reach `error.tsx` (Try
      Again + Sentry); `notFound()` fires only on missing or hidden beers
      (the hidden-beer guard is F-S5, folded here — adjacent lines):

```ts
// No try/catch: a thrown Payload/DB error must reach error.tsx,
// not masquerade as a 404 for a real product URL.
const beer = await getBeerBySlug(variant)
if (!beer) notFound()
if (beer.availability?.hideFromSite) notFound()
```

      (Types: `Beer` from `src/payload-types.ts`; confirm the exact path of
      `hideFromSite` there — `sitemap.ts:83` filters on the same field.)
- [ ] `pnpm type-check && pnpm test`
- [ ] Commit: `fix(beer): 404 only for missing/hidden beers; rethrow DB errors`

**Phase 1 exit:** PR `fix(views): paint-blocking transition, skeletons, streamed shell`
with before/after LCP + `opacity:0` counts in the body. CHECKPOINT — pause for review.

---

## Phase 2 — Efficiency: data payload & compute (PR `perf/data-payload`)

### Task 6: Narrow the three fat Payload queries  [F-E3, F-E4]

**Files:**
- Modify: `lib/utils/payload-api.ts:86-95` (`limit: 1000, depth: 2` beers query)
- Modify: `lib/utils/payload-api.ts:165-182` (homepage `depth: 3` query)
- Modify: `lib/utils/payload-api.ts:450-459` (`depth: 3, limit: 1000` query)
- Test: `tests/int/payload-query-shape.int.spec.ts` (new)

**Interfaces:** return types stay the collection types but with fewer
populated fields; grep every downstream consumer (`featured-menu.tsx`,
`beer-page-content.tsx`, `hero-section.tsx`) for field access before
choosing the field lists.

- [ ] **Measure before:** `curl -s https://lolev.beer/ | wc -c` (baseline
      ~710 KB) and record the field census
      (`grep -o '\\"username\\"' | wc -l` ≈ 572).
- [ ] For each of the three queries, add a `populate`/`select` block modeled
      on the existing `MENU_POPULATE` (`payload-api.ts:237-278`), which
      already excludes `positiveReviews`. At minimum exclude:
      `positiveReviews`, media `sizes` variants not rendered, and
      `createdAt`/`updatedAt` where unused.
- [ ] Export the query-options objects as named constants and write the
      test: assert `positiveReviews` is not selected/populated in any of
      the three.
- [ ] Verify pages still render: `pnpm build && pnpm start`, load `/`,
      `/beer`, and a beer detail (the detail page's reviews section must
      still work — `getBeerBySlug` keeps its reviews).
- [ ] **Measure after:** homepage HTML size — expect well under 200 KB.
- [ ] `pnpm type-check && pnpm test && pnpm build`
- [ ] Commit: `perf(data): narrow beer/menu queries; stop serializing reviews into pages`

### Task 7: Cap `positiveReviews` growth  [F-E3]  (after 6)

**Files:**
- Create: `lib/utils/merge-positive-reviews.ts`
- Modify: `src/collections/Beers.ts:153` (the append hook)
- Test: `tests/int/merge-positive-reviews.int.spec.ts` (new)

**Interfaces — produces:**

```ts
/** Newest-last merge, deduped by (username, text), capped at max. */
export function mergePositiveReviews<T extends { username?: string; text?: string }>(
  existing: T[], incoming: T[], max?: number, // default 50
): T[]
```

- [ ] Implement the pure function; the hook becomes
      `data.positiveReviews = mergePositiveReviews(existing, newReviews)`.
- [ ] Test the pure function directly (cap, dedupe, order) — the repo's int
      tests are mocked, never DB-backed; no Payload boot.
- [ ] `pnpm type-check && pnpm test`
- [ ] Commit: `perf(beers): cap positiveReviews at 50, newest first`

### Task 8: Align display polling with edge caching  [F-E1, F-E2] — MEASURE FIRST

**Files:**
- Modify: `lib/hooks/use-polling.ts:98`
- Modify: `components/menu/live-menu.tsx:25-28`
- Modify: `components/events/live-events.tsx:165-172`
- Modify: `src/app/api/menu-stream/[url]/route.ts:82-84`
- Modify: `src/app/api/events-stream/[location]/route.ts:96-98`

**Preflight:** `git worktree list` — if the ux-tweaks worktree has
`live-menu.tsx` dirty, coordinate before touching it.

- [ ] **Measure first (required):** request a real menu-stream URL twice
      within 10s, once **with** `-H 'Cache-Control: no-cache'` and once
      without, recording `x-vercel-cache` each time. This proves whether the
      current `no-store` polls bypass the edge (MISS every poll) or not.
      Record numbers in the PR.
- [ ] `use-polling.ts`: remove `{ cache: 'no-store' }` from the fetch.
- [ ] Both stream routes: change the response header to
      `public, max-age=2, s-maxage=10, stale-while-revalidate=30` (the added
      browser-side `max-age` means removing `no-store` cannot serve stale
      beyond 2s).
- [ ] `live-menu.tsx` / `live-events.tsx`: set `pollInterval: 10_000` (menu)
      and keep events at `5_000` only if the measure step showed edge HITs;
      otherwise `10_000` both. A display change then appears within 10–20s —
      which matches the pre-existing `s-maxage=10` ceiling, so no
      visitor-visible guarantee changes.
- [ ] Verify on a real display (or a browser tab left on `/m/...`): updates
      still arrive after a menu edit in admin; the network tab shows cache
      HITs between changes.
- [ ] `pnpm type-check && pnpm test`
- [ ] Commit: `perf(displays): let the edge absorb polls; align interval with s-maxage`

### Task 9: Trim Sentry client/server overhead  [F-E9]  (parallel with 6–8)

**Files:**
- Modify: `instrumentation-client.ts:13-27`
- Modify: `sentry.server.config.ts:8-11`

- [ ] Client: replace the static `Sentry.replayIntegration()` with
      `Sentry.lazyLoadIntegration('replayIntegration')` per Sentry v10 docs,
      and remove `browserProfilingIntegration` (its server counterpart was
      never installed).
- [ ] Keep kiosks out of tracing/replay:

```ts
tracesSampler: () => {
  const path = typeof location !== 'undefined' ? location.pathname : ''
  if (path.startsWith('/m/') || path.startsWith('/e/')) return 0
  return 0.2
},
replaysSessionSampleRate: 0, // keep replaysOnErrorSampleRate as-is
```

      (10% session replay on kiosk sessions that never end is the
      pathological case — error-triggered replay stays everywhere.)
- [ ] Server: delete the no-op `profilesSampleRate`; add a `tracesSampler`
      returning 0 for `/api/menu-stream` + `/api/events-stream`
      transactions, 0.2 otherwise.
- [ ] Verify: an artificial client error on `/` still reaches Sentry (throw
      from a temp button in dev with the DSN set).
- [ ] `pnpm type-check && pnpm test`
- [ ] Commit: `perf(sentry): lazy replay, no tracing/replay on kiosk routes`

### Task 10: Move distributor GeoJSON out of the document  [F-E10]  (parallel)

**Files:**
- Create: `src/app/api/distributors/route.ts`
- Modify: `src/app/(frontend)/beer-map/page.tsx:44-69`
- Modify: `components/beer/beer-map-content.tsx`

**Interfaces:** the route returns the exact array shape currently passed as
`distributorData` (trace its type from `beer-map-content.tsx` props);
`BeerMapContent` fetches it client-side and no longer takes the prop.

- [ ] Route: reuse the existing query at `payload-api.ts:1145-1153`; respond
      with `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.
- [ ] `beer-map-content.tsx`: fetch `/api/distributors` inside the
      lazy-loaded map component (parallel with the mapbox-gl download);
      render the map immediately, add pins when data lands.
- [ ] Remove the server-side fetch + prop from `beer-map/page.tsx`.
- [ ] Verify: `/beer-map` document size shrinks (curl before/after); pins
      still render.
- [ ] `pnpm type-check && pnpm test && pnpm build`
- [ ] Commit: `perf(beer-map): serve distributor GeoJSON from a cached route`

**Phase 2 exit:** PR `perf(data): payload narrowing, polling alignment, Sentry + map`
with before/after homepage bytes and poll `x-vercel-cache` evidence. CHECKPOINT.

---

## Phase 3 — SEO (PR `fix/seo-remediation`)

### Task 11: Sitemap tells the truth  [F-S1, F-S9]

**Files:**
- Modify: `src/app/sitemap.ts:21-108`
- Test: `tests/int/sitemap.int.spec.ts` (new; mock the payload-api imports,
  assert no emitted URL matches `/\/(lawrenceville|zelienople)$/` and that
  static entries carry fixed dates)

- [ ] Delete the `locationPages` block (lines 94-105) and its spread in the
      return (line 110).
- [ ] Replace every `lastModified: new Date()` on the ten static entries
      with a real constant (each page's last meaningful edit:
      `git log -1 --format=%cs -- <page file>`); derive `/beer`, `/events`,
      `/food` entries from `max(updatedAt)` of the docs already fetched in
      this file.
- [ ] `pnpm type-check && pnpm test`
- [ ] Commit: `fix(seo): drop 404 location URLs from sitemap; real lastModified`

### Task 12: Social cards restored  [F-S2, F-S3, F-S4]

**Files:**
- Modify: `src/app/(frontend)/layout.tsx:88-107`
- Modify: `about/page.tsx:31-35`, `accessibility/page.tsx:10-14`,
  `beer/page.tsx:33-37`, `beer-map/page.tsx:35-39`, `events/page.tsx:26-31`,
  `faq/page.tsx:70-74` (all under `src/app/(frontend)/`)
- Create (asset): `public/images/og-image.jpg` (from the 2.4 MB PNG)

- [ ] Re-encode the OG image with the installed `sharp` (one-off node
      script): 1200×630 JPEG quality 80; confirm ≤ 200 KB.
- [ ] Layout: point `openGraph.images` and `twitter.images` at
      `/images/og-image.jpg`; delete `twitter.title` and
      `twitter.description` (per-page OG then wins on unfurlers;
      `twitter.card` stays).
- [ ] Export `export const DEFAULT_OG_IMAGES = ['/images/og-image.jpg']`
      from `lib/utils/seo.ts` (new or existing) and add
      `images: DEFAULT_OG_IMAGES` to each of the six pages' `openGraph`.
- [ ] Verify on the preview deploy:
      `curl -A Slackbot -s https://<preview>/beer | grep og:image` shows the
      image on all six pages.
- [ ] `pnpm type-check && pnpm test`
- [ ] Commit: `fix(seo): og:image on all indexable pages; 200KB card image; per-page twitter titles`

### Task 13: Copy + platform-meta fixes  [F-S7, F-U14, /beer typos]  (parallel, trivial)

**Files:**
- Modify: `src/app/(frontend)/beer/page.tsx:18` — "hop saturate ales to
  crisy lager" → "hop-saturated ales to crisp lagers"
- Modify: `src/app/(frontend)/faq/page.tsx:64` — `title: 'Brewery FAQ'`
- Modify: `src/app/(frontend)/layout.tsx:148` —
  `apple-mobile-web-app-title` → `Lolev`
- Modify: `layout.tsx:144` — `theme-color` → `#ffffff`
- Modify: `public/favicons/site.webmanifest` — `display` → `standalone`

- [ ] `pnpm type-check && pnpm test`
- [ ] Commit: `fix(seo): meta description typos, FAQ title, iOS title/theme-color`

### Task 14: Single `getBaseUrl`  [F-S10]  (after #162 merges)

**Files:**
- Create: `lib/utils/get-base-url.ts`
- Modify: `src/app/robots.ts:4-10`, `src/app/sitemap.ts:~11`,
  `src/app/(frontend)/layout.tsx:~39`, `src/utils/slack.ts` (its copy)
- Test: `tests/int/get-base-url.int.spec.ts`

**Interfaces — produces:**

```ts
/** Resolution: NEXT_PUBLIC_SITE_URL → VERCEL_PROJECT_PRODUCTION_URL →
 *  VERCEL_URL → https://lolev.beer. Never localhost: a wrong prod canonical
 *  deindexes the site; local metadata pointing at prod is harmless. */
export function getBaseUrl(): string
```

- [ ] Implement + test (env-var permutations via `vi.stubEnv`), swap all
      four call sites, delete their local copies. `layout.tsx`'s localhost
      fallback is deliberately dropped — see the doc comment.
- [ ] `pnpm type-check && pnpm test`
- [ ] Commit: `refactor(seo): one getBaseUrl for robots, sitemap, metadata, slack`

### Task 15: Link hygiene  [F-S6, F-S8, F-U11]  (parallel)

**Files:**
- Modify: `components/layout/footer.tsx:257`
- Modify: `components/beer/beer-card.tsx:35`,
  `components/beer/draft-beer-card.tsx:72`
- Modify: `components/beer/beer-details.tsx:245`

- [ ] Footer: `<Link href="/admin">` → `<a href="/admin" rel="nofollow">`.
- [ ] Flip both `showLocation` defaults to `false` (all four current call
      sites already pass `false`; the location-prefixed URL branch points at
      a route that does not exist).
- [ ] `beer-details.tsx:245`: `/${currentLocation}/beer` → `/beer`.
- [ ] Verify: `grep -rn 'currentLocation}/beer' components/` returns only
      the (now default-off) card branches or nothing.
- [ ] `pnpm type-check && pnpm test`
- [ ] Commit: `fix(seo): nofollow admin link, kill ghost location-prefixed beer links`

### Task 16: Breadcrumbs on the big three  [F-S11]  (parallel)

**Files:**
- Modify: `src/app/(frontend)/beer/page.tsx:~52`, `events/page.tsx:~65`,
  `food/page.tsx:~298`

- [ ] Add alongside each page's existing schema component (copy the import
      lines from `about/page.tsx` — `generateBreadcrumbSchema` and `JsonLd`
      already exist):

```tsx
<JsonLd data={generateBreadcrumbSchema([
  { label: 'Home', href: '/' },
  { label: 'Beer', href: '/beer' }, // Events / Food accordingly
])} />
```

- [ ] `pnpm type-check && pnpm test`
- [ ] Commit: `feat(seo): breadcrumb schema on beer, events, food`

**Phase 3 exit:** PR `fix(seo): sitemap, social cards, links, base URL, breadcrumbs`.
After deploy: request re-index of `/beer` + `/events` in Search Console. CHECKPOINT.

---

## Phase 4 — Accessibility & UX polish (PR `fix/a11y-polish`)

### Task 17: Contrast + focus visibility  [F-U4, F-U6]

**Files:**
- Modify: `src/app/(frontend)/globals.css:26` —
  `--color-muted-foreground: #86868b` → `#6e6e73` (5.07:1; the dark-mode
  value at line 104 is already compliant — leave it)
- Modify: `components/ui/tabs.tsx:70` — replace `focus-visible:outline-none
  focus:outline-none` with `focus-visible:ring-2 focus-visible:ring-ring
  focus-visible:ring-offset-2` (pattern from `components/ui/button.tsx:7`)
- Modify: `components/ui/theme-switcher.tsx:133-139` — add
  `peer-focus-visible:ring-2 peer-focus-visible:ring-ring` to the label and
  bump targets `w-8 h-8` → `w-11 h-11` (44px)

- [ ] Verify: keyboard-tab through header + footer in dev — every
      interactive control shows a ring; confirm #6e6e73-on-#ffffff ≥ 4.5:1
      with a contrast checker.
- [ ] `pnpm type-check && pnpm test`
- [ ] Commit: `fix(a11y): AA contrast for muted text; visible focus on tabs + theme switcher`

### Task 18: Mobile menu is a real dialog  [F-U5]  (parallel)

**Files:**
- Modify: `components/layout/mobile-menu.tsx`
- Modify: `components/layout/navigation.tsx:118`

- [ ] Rebuild the panel on Radix `Dialog` (`components/ui/dialog.tsx`
      exists; Radix supplies focus trap, initial focus, focus return,
      background `aria-hidden`, Escape). Keep current styling by passing the
      existing classes to `DialogContent`; delete the hand-rolled
      Escape/body-scroll-lock code Radix now owns.
- [ ] Both files: gate their framer-motion animations with
      `useReducedMotion()` the way every component in `components/motion/*`
      already does (copy that pattern).
- [ ] Verify on a mobile viewport: open menu → focus lands inside; Tab
      cycles within; Escape closes and returns focus to the hamburger.
- [ ] `pnpm type-check && pnpm test`
- [ ] Commit: `fix(a11y): Radix dialog for mobile menu; respect reduced motion in nav`

### Task 19: Keyboard-reachable links  [F-U7, F-U8]  (parallel)

**Files:**
- Modify: `components/beer/top-beer-drops-link.tsx:15-23`
- Modify: `components/home/upcoming-food.tsx:84-108`
- Modify: `components/ui/timeline-item.tsx:87`

- [ ] `top-beer-drops-link.tsx`: replace the `span[role=link]` with
      `<a href={url} target="_blank" rel="noopener noreferrer"
      aria-label="View on Top Beer Drops">`, keeping the icon child.
- [ ] `upcoming-food.tsx`: apply the repo's own correct pattern from
      `timeline-item.tsx:90-93` (`role="link"`, `tabIndex={0}`, `onKeyDown`
      Enter/Space, `aria-label` naming the vendor).
- [ ] Both `window.open` calls: add `'noopener,noreferrer'` as the third
      argument.
- [ ] Verify: a keyboard-only pass over the homepage reaches and activates
      both.
- [ ] `pnpm type-check && pnpm test`
- [ ] Commit: `fix(a11y): real links for Top Beer Drops icon and food cards`

### Task 20: Layout nits  [F-U12, F-U13]  (parallel)

**Files:**
- Modify: `components/beer/beer-map-content.tsx:41` — replace the inline
  `height: '700px'` with `className="relative h-[60vh] md:h-[700px]"` and
  make `DistributorMap` fill its parent (read its props first — pass
  `height="100%"` or measure via a ref, whichever it supports)
- Modify: `components/beer/beer-page-content.tsx:142` — `sticky top-16` →
  `top-14` (matches the scrolled header height at `header.tsx:45`)

- [ ] Verify (measure-first rule): screenshot `/beer-map` at 375×667 and
      `/beer` mid-scroll before and after — the map fits the viewport and
      no gap opens above the filter bar.
- [ ] `pnpm type-check && pnpm test`
- [ ] Commit: `fix(ux): responsive map height; sticky filter offset matches shrunk header`

**Phase 4 exit:** PR `fix(a11y): contrast, focus, dialog semantics, keyboard access`. CHECKPOINT.

---

## Phase 5 — Asset pipeline (PR `perf/assets`) — largest, do last

### Task 21: Image optimizer configuration  [F-E7]

**Files:**
- Modify: `next.config.mjs:37-58` (images block)
- Modify: `components/home/hero-section.tsx:63-67`

- [ ] Add to the images block (keep existing `formats` + `remotePatterns`):

```js
deviceSizes: [640, 828, 1080, 1920],
imageSizes: [48, 64, 96, 150, 400],
minimumCacheTTL: 2678400, // 31 days; media URLs are content-addressed
```

- [ ] Add `sizes` to the hero image, which currently defaults to `100vw`:
      verify its rendered size in DevTools first (measure-first), then set
      e.g. `sizes="(max-width: 768px) 64px, 96px"` to match.
- [ ] `pnpm build`, click through `/`, `/beer`, a detail page: no blurry
      images (if one appears, its rendered width is missing from the
      arrays — add that width, don't revert).
- [ ] Commit: `perf(images): trim srcset widths, month-long optimizer cache`

### Task 22: Serve the thumbnails Payload already makes  [F-E8]

**Files:**
- Modify: `components/home/hero-section.tsx:50-52`
- Modify: `components/home/upcoming-food.tsx:84`
- Modify: `lib/utils/payload-api.ts:427`,
  `src/app/(frontend)/food/page.tsx:207`

- [ ] Pass the size arg (`'thumbnail'` for ≤96px renders, `'card'`
      elsewhere) to `getMediaUrl`/`getBeerImageUrl` at each call site —
      mirroring the one correct usage at `featured-menu.tsx:244`. Read
      `lib/utils/media-utils.ts` for the exact signature first.
- [ ] Verify each surface renders; the legacy `image === true` fallback path
      has no variants — leave it on the original URL.
- [ ] `pnpm type-check && pnpm test`
- [ ] Commit: `perf(images): request Payload thumbnails where 64-96px is rendered`

### Task 23: Compress the 3D can  [F-E6]

**Files:**
- Create: `public/3d/can.glb` (replaces `Can.gltf` + `buffer.bin`)
- Modify: `components/beer/can-scene.ts:141`
- Modify: `components/beer/beer-can-3d.tsx:71-79`

- [ ] One-off (not a repo dep):
      `npx gltf-transform optimize public/3d/Can.gltf public/3d/can.glb --compress meshopt`
      — expect ≤ ~300 KB from 4 MB. Wire `MeshoptDecoder` (from
      `three/examples/jsm/libs/meshopt_decoder.module.js`, already shipped
      with the installed `three`) into the loader:
      `loader.setMeshoptDecoder(MeshoptDecoder)`. Delete the old
      `Can.gltf` + `buffer.bin`.
- [ ] Move the `createCanScene()` call behind the existing
      IntersectionObserver so the .glb + three.js download only when the can
      nears the viewport; the poster image stays as the placeholder.
- [ ] Verify (measure-first): DevTools network on a beer detail — total 3D
      payload before (~4.2 MB) vs after (< 500 KB); the can still renders
      and rotates on desktop and iOS Safari.
- [ ] `pnpm type-check && pnpm test`
- [ ] Commit: `perf(3d): meshopt-compressed can, lazy-load scene on visibility`

### Task 24: Migrate `public/images/beer` originals  [F-E5] — propose before doing

168 MB of source PNGs ships with every deploy; `media-utils.ts:149` routes
legacy beers to them. The right fix is a one-off import into Payload Media
(blob storage + generated sizes) built on the existing
`scripts/import-beer-images.ts`, then deleting the directory and the legacy
branch in `media-utils.ts`. **This mutates production CMS data — per the
bulk-data rule it must be a script, and it needs Ted's explicit go-ahead
plus a list of which beers still have `image === true`.** Scope it in its
own session; nothing beyond this note belongs in the Phase 5 PR.

**Phase 5 exit:** PR `perf(assets): image sizing, thumbnails, compressed 3D can`
with byte counts. Task 24 proposed separately. FINAL CHECKPOINT.

---

## Parallelism map

- Phase order 1 → 2 → 3 → 4 → 5 (ordered by impact). Phases 3 and 4 can run
  concurrently in separate worktrees — they share no files. Phase 2 follows
  1 (both touch the homepage render path; sequencing keeps measurements
  attributable).
- Within phases: 1‖2‖3‖4‖5 (Phase 1); 6→7, with 8, 9, 10 parallel (Phase 2);
  11‖12‖13‖15‖16, 14 after #162 merges (Phase 3); 17‖18‖19‖20 (Phase 4);
  21‖22‖23 (Phase 5).

## Explicitly out of scope (tracked elsewhere)

- TV sprite-sheet memory/paint work — needs on-hardware paint traces
  (docs/plans/perf-simplification.md "Deferred").
- Bare `/m` + `/e` layout route group — same doc.
- Structural splits (`featured-menu.tsx` etc.) — same doc, needs approval.
- CSP header — deliberately skipped (Mapbox/Payload/Sentry inline surface).
- MongoDB Atlas backup verification — not repo-controllable.

---

## Findings reference (the spec)

### SEO
- **F-S1** `src/app/sitemap.ts:94-105` emits `/lawrenceville`-style URLs; no
  `[location]` route exists → sitemap full of soft 404s.
- **F-S2** Six pages define `openGraph` without `images`; Next's shallow
  merge drops the inherited og:image (about, accessibility, beer, beer-map,
  events, faq).
- **F-S3** `public/images/beer/og-image.png` is 2.4 MB — above Slack/LinkedIn
  scraper caps; unfurls render nothing.
- **F-S4** Only the layout defines `twitter:*`, so every page shares one
  twitter title/description, overriding per-page OG on unfurlers.
- **F-S5** `beer/[variant]` renders beers flagged `hideFromSite` (sitemap and
  cards filter it; the page doesn't) with `InStock` Product schema.
- **F-S6** Footer follows a sitewide link to robots-blocked `/admin`.
- **F-S7** FAQ title renders "FAQ | Frequently Asked Questions | Lolev Beer".
- **F-S8** `showLocation` defaults `true` in beer cards, generating
  `/{location}/beer/{slug}` hrefs to a nonexistent route (latent — all
  callers pass `false`).
- **F-S9** All static sitemap entries use `lastModified: new Date()` →
  Google discounts lastmod signals site-wide.
- **F-S10** Four divergent base-URL resolvers; `layout.tsx` falls back to
  `http://localhost:3000` for canonicals.
- **F-S11** No BreadcrumbList on `/beer`, `/events`, `/food` (all other
  pages have it).
- Bonus: `/beer` meta description typos "hop saturate ales to crisy lager".

### UX / views
- **F-U1** `PageTransition`/`BlurFade` render `opacity:0` + blur into SSR
  HTML on every major page — blank page until hydration (verified live).
- **F-U2** Zero `loading.tsx` files; cache-miss navigations block with no
  feedback.
- **F-U3** Root layout awaits two serial CMS fetches (footer hours) before
  streaming any route.
- **F-U4** `--color-muted-foreground: #86868b` on white = 3.62:1, below AA;
  used for nearly all secondary text in light mode.
- **F-U5** Mobile menu: `role=dialog` without focus trap/initial
  focus/focus return/inert background; menu + nav underline ignore
  `useReducedMotion`.
- **F-U6** `tabs.tsx` strips both focus outlines with no replacement (header
  location switcher); theme switcher has no visible focus and 32px targets.
- **F-U7** Top Beer Drops icon is `span[role=link]` — no
  tabIndex/keys/name.
- **F-U8** Homepage food cards are onClick-only; `window.open` without
  noopener (also `timeline-item.tsx:87`).
- **F-U9** Hero shows permanent "Loading available beers…" when the list is
  simply empty.
- **F-U10** Transient DB errors on beer pages render as 404 "Beer Not
  Found".
- **F-U11** `beer-details.tsx:245` links to nonexistent `/{location}/beer`.
- **F-U12** `/beer-map` hard-codes a 700px map — taller than an iPhone SE
  viewport, swallows scroll.
- **F-U13** Sticky filter bar `top-16` vs header that shrinks to `h-14` —
  8px see-through gap when scrolled.
- **F-U14** `apple-mobile-web-app-title` says "LoL Brewing"; `theme-color`
  `#8B5A3C` matches nothing; manifest `display: fullscreen`.

### Efficiency
- **F-E1** `use-polling.ts` fetches with `cache:'no-store'` → browser sends
  `Cache-Control: no-cache`, likely bypassing the edge cache the stream
  routes were designed around; ~43k req/day per display.
- **F-E2** Poll every 2s against `s-maxage=10` — ≥80% of polls are
  byte-identical by construction.
- **F-E3** `positiveReviews` grows monotonically (append hook, no cap) and
  rides in the three fat queries in `payload-api.ts` (no select/populate);
  measured live: homepage RSC payload 710 KB with ~572 review objects and
  ~1,100 media-variant records.
- **F-E4** Every beer save revalidates `/` + `/beer`, re-running those fat
  queries; fixing F-E3 is the lever.
- **F-E5** 168 MB of 2–3 MB source PNGs in `public/images/beer`; legacy
  beers serve from them.
- **F-E6** 4 MB uncompressed glTF buffer downloaded on every beer-detail
  visit; the IntersectionObserver gates only the rAF loop, not the
  download.
- **F-E7** Default `deviceSizes` (up to 3840) + 60s `minimumCacheTTL` →
  paying for transformations no visitor requests, regenerated too often;
  hero `fill` has no `sizes` (→ 100vw srcset).
- **F-E8** Payload generates 150/500/1200px variants but only one call site
  uses them; 64px renders pull full-res originals; a 4-megapixel metalness
  mask is fed raw to three.js.
- **F-E9** Sentry Replay + Profiling statically imported everywhere incl.
  24/7 kiosks; 10% session replay on never-ending display sessions; 20%
  tracing on the poll endpoints; server `profilesSampleRate` is a no-op.
- **F-E10** Up to 2,000 distributor features (~360 KB) inlined into the
  `/beer-map` flight payload for an `ssr:false` component.

### Verified clean (do not "fix")
Metadata/canonicals on all routes; Product/Event/FAQ/LocalBusiness schema;
alt text; single h1s; fonts (`display:swap`); viewport (no maximumScale);
`next/image` everywhere with `fill`+`sizes`; three.js/mapbox lazy-loaded;
ISR on every route, no `force-dynamic`; empty states; error boundaries;
skip-nav; stream endpoints are cached JSON (correct for Fluid Compute).
