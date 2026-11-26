# Scroll tour: the can inside the brewery, on the homepage

Status: plan, awaiting approval. No implementation code yet.

## What we are building

The top of the homepage becomes a scroll-driven walk through the Lawrenceville
brewery. One WebGL scene holds both the building (the model from
`lolevbeer/hq`) and our 3D can. Scrolling moves the camera between stops; each
stop has normal HTML content and a link, so the tour is also navigation.

| Stop | Hash | Camera (HQ view) | Content and link |
|---|---|---|---|
| 1 | `#can` | Close on the can, standing on the bar | Hero copy, featured beer, link to its page |
| 2 | `#bar` | Bar | On draft now, link to `/beer` |
| 3 | `#seating` | Seating | Events and food, links to `/events`, `/food` |
| 4 | `#brewery` | Brewery | The can beside the fermenters; cans, link to `/beer` |
| 5 | `#visit` | Overview (roof off, outside) | Both taprooms, hours, directions |

Behind bar and Upstairs are left out.

## Decisions taken (owner: "balance experience and performance")

1. **Homepage, not a separate page.** The current hero stays as the first
   paint and the fallback; the 3D loads after it.
2. **One source of truth for the model.** `hq` gains a second build output, a
   module with no imports. The site keeps a pinned, generated copy.
3. **Three quality levels**, chosen on the device and corrected by measurement:

| Level | Who gets it | What runs |
|---|---|---|
| `full` | Desktop-class GPU, WebGL 2 | Baked shadows, mirrors, frosted glass, pixel ratio up to 1.5. No ambient occlusion or bloom (HQ's two most expensive passes) |
| `lite` | Phones and low-memory devices | No post-processing, mirrors and glass as plain materials, no area lights, half-size textures, pixel ratio 1 |
| `none` | No WebGL 2, reduced motion, Save-Data, or `lite` still too slow | Today's homepage, unchanged |

## Performance rules

- The hero image stays the LCP element. three.js and the model load only after
  `load` plus an idle slot (the existing `afterLoadAndIdle` in
  `components/beer/beer-can-3d.tsx`, moved to a shared file, not copied).
- No scroll-jacking: native scrolling, a sticky canvas, and a passive scroll
  listener that feeds one `requestAnimationFrame`.
- Render on demand: a frame is drawn only when scroll progress or size
  changes. Nothing runs while the section is off screen or the tab is hidden.
- Shadows are drawn once (the scene is static, as in HQ).
- After the first 60 drawn frames, an average over 40 ms drops `full` to
  `lite`; if `lite` is also over, the scene is disposed and the page is `none`.
- Download budget for the tour: 1.2 MB at `lite`, 2 MB at `full`, textures as
  WebP files, not embedded.
- One WebGL context on the page; it is released on unmount
  (`forceContextLoss`, as `can-scene.ts` already does).

## Types

```ts
// lib/tour/stops.ts
export type TourStopId = 'can' | 'bar' | 'seating' | 'brewery' | 'visit'
export interface TourStop {
  id: TourStopId
  label: string
  href: string
  /** Camera position and target, in HQ's feet. */
  camera: { p: [number, number, number]; t: [number, number, number] }
  /** HQ group switches: ceiling and upper floor. */
  ceil: boolean
  up: boolean
  /** Where the can stands at this stop, in feet; null hides it. */
  can: [number, number, number] | null
}

// lib/tour/pose.ts
export interface TourPose {
  p: [number, number, number]
  t: [number, number, number]
  stop: TourStopId
  ceil: boolean
  up: boolean
  can: [number, number, number] | null
}

// lib/tour/quality.ts
export type TourQuality = 'full' | 'lite' | 'none'

// lib/hq/lolev-model.js (generated in hq)
export function buildModel(deps: {
  THREE: typeof import('three')
  addons: { mergeGeometries; RoomEnvironment; Reflector; RectAreaLightUniformsLib }
  renderer: WebGLRenderer
  scene: Scene
  textureUrl: (name: string) => string
  quality: 'full' | 'lite'
}): { groups: Record<string, Group>; dispose: () => void }
export const VIEWS: Record<string, { p: number[]; t: number[]; ceil: boolean; up: boolean }>
```

## Tasks

Phases end with a checkpoint: report what is left and wait.

### Phase A: `lolevbeer/hq` (sequential)

**A1. Separate the model from the viewer bootstrap**
- Files: `3d/src/core.js` (split), new `3d/src/model-core.js`, `tools/scene_sources.py`.
- Test first: `python3 tools/build_3d.py --check` and `python3 tools/smoke.py` (existing).
- Done when: the viewer page is unchanged and the smoke test passes; `MODEL`
  sources no longer read `document` except to create canvases.
- Depends on: nothing.

**A2. Module build with quality levels**
- Files: new `tools/build_module.py`, output `dist/lolev-model.js`; quality
  switches in `materials/catalog.js`, `interior/mirrors.js`, `lighting.js`.
- Test first: new `tools/smoke_module.py` (headless Chrome): imports the
  module, builds at `full` and `lite`, asserts mesh count over zero, no
  zero-length normals, no `Reflector` or `RectAreaLight` at `lite`.
- Done when: the smoke test passes and the file contains no `import` statement.
- Depends on: A1.

**A3. Texture files and publishing**
- Files: `tools/texture_assets.py`, `.github/workflows/pages.yml`, output
  `dist/tex/*.webp` at two sizes.
- Test first: `tools/smoke_module.py` asserts every texture name the module
  asks for exists in `dist/tex/` and the two sets total under 1.2 MB and 600 KB.
- Depends on: A2.

Checkpoint A.

### Phase B: site foundations (B1, B3, B4, B5 in parallel; B2 after A3)

**B1. Align three.js**
- Files: `package.json`, `pnpm-lock.yaml` (three 0.186 to 0.187).
- Test first: `tests/int/beer-can-3d-motion.int.spec.tsx` (existing) plus a
  visual check of a beer page can.
- Done when: `tsc --noEmit` and the suite pass.

**B2. Pinned copy of the HQ module**
- Files: new `scripts/sync-hq-model.mjs`, `lib/hq/lolev-model.js`,
  `lib/hq/lolev-model.d.ts`, `public/3d/hq/*.webp`.
- Test first: `tests/int/hq-model-sync.int.spec.ts`: the copy's header names
  the pinned commit, exports `buildModel` and `VIEWS`, has no `import`.
- Depends on: A3.

**B3. Can as an object, not a whole scene**
- Files: `components/beer/can-scene.ts` (extract `createCanObject`, which
  `createCanScene` then calls), no change to its two callers.
- Test first: `tests/int/can-label-geometry.int.spec.ts` for the extracted
  wrap-angle maths; the render is checked visually on a beer page.
- Done when: beer pages and the admin can video look the same as before.

**B4. Stops and camera pose**
- Files: new `lib/tour/stops.ts`, `lib/tour/pose.ts`.
- Test first: `tests/int/tour-pose.int.spec.ts`: progress 0 and 1 give the
  first and last stops, the midpoint between two stops is between their
  cameras, `stopAt` and `progressForStop` round-trip, the can is hidden while
  it moves between stops.

**B5. Quality choice**
- Files: new `lib/tour/quality.ts`, new `lib/utils/after-load-and-idle.ts`
  (moved from `beer-can-3d.tsx`).
- Test first: `tests/int/tour-quality.int.spec.ts`: reduced motion, Save-Data
  and missing WebGL 2 give `none`; a phone gives `lite`; slow frame times step
  down one level at a time.

Checkpoint B.

### Phase C: the tour (sequential)

**C1. One scene**
- Files: new `components/home/tour-scene.ts`:
  `createTourScene({ canvas, quality, label })` returning
  `{ renderAt(progress), setSize, dispose }`.
- Test first: the logic is covered by B4 and B5; the render is verified by
  capture (the `measure-first` skill) at each stop, desktop and phone widths.
- Depends on: B2, B3, B4, B5.

**C2. The scroll component**
- Files: new `components/home/scroll-tour.tsx`.
- Test first: `tests/int/scroll-tour.int.spec.tsx`: at quality `none` it
  renders every stop's heading and link and no canvas; the rail marks the
  current stop with `aria-current`; a stop hash scrolls to that stop.
- Depends on: C1.

**C3. Homepage integration**
- Files: `components/home/home-content.tsx`, `components/home/hero-section.tsx`.
- Test first: `tests/int/home-tour-loading.int.spec.ts`: the homepage files
  reach `three`, `tour-scene` and `lib/hq` only through `dynamic` imports.
- Done when: with JavaScript off the homepage is today's page.
- Depends on: C2.

Checkpoint C.

### Phase D: measure and document

**D1. Measure and tune**
- Lighthouse on the preview deployment before and after (local LCP numbers are
  not meaningful); frame times on a real phone. Tune stops and the levels.
- Done when: LCP and total blocking time on the preview are within 5% of main,
  and `lite` holds 30 frames a second on the test phone.

**D2. Documentation**
- Files: `AGENTS.md` (a short "3D tour" section: where the model comes from,
  how to re-sync, the three levels), `README.md`, module comments on every new
  file; `hq`'s `README.md` for the module build.

## No database changes

Nothing in Payload changes. The featured can uses the label textures the hero
already receives (`heroBeers`).

## Risks

- **Phones.** HQ was tuned for a desktop viewer. If `lite` cannot hold frame
  rate on a mid-range phone, phones get the static page and the tour is
  desktop-only.
- **Content Security Policy.** The policy is report-only; the model is bundled
  and its textures are same-origin, so no new sources are needed.
- **Model drift.** The site's copy is pinned; a new HQ model needs a re-sync.
