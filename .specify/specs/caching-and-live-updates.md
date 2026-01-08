# Feature Specification: Caching and Live Menu Updates

**Feature Branch**: `payload`
**Created**: 2025-12-10
**Updated**: 2026-01-08
**Status**: Implemented (SSE replaced with cached polling)
**Input**: User description: "Optimize site caching with Payload CMS revalidation and add live updates to menu displays"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instant Menu Updates in Admin (Priority: P1)

When a staff member updates a menu in Payload CMS admin (adding/removing beers, changing prices), the changes should be reflected on the public-facing menu pages without waiting for a cache timeout.

**Why this priority**: Core business need - menus change frequently during service and displays need to stay current.

**Independent Test**: Update a menu item in Payload admin → verify the public menu page shows new data within 5 seconds.

**Acceptance Scenarios**:

1. **Given** a published menu exists, **When** admin updates a beer on the menu and publishes, **Then** the public menu page reflects the change on next request (server) and within 5 seconds (SSE stream)
2. **Given** a menu display is open in a browser, **When** admin adds a new beer to the menu, **Then** the display updates automatically within 5 seconds without page refresh
3. **Given** a menu display is showing beers, **When** admin removes a beer, **Then** the beer animates out (slides left + fades)
4. **Given** a menu display is showing beers, **When** admin adds a beer, **Then** the beer animates in (slides from right + scales up with bounce)

---

### User Story 2 - Efficient Resource Usage (Priority: P2)

Menu displays (TVs in taproom) should receive updates efficiently without excessive bandwidth or server load, minimizing Vercel "Fluid Active CPU" costs.

**Why this priority**: 20+ displays running 24/7 need to be cost-effective. SSE was keeping serverless functions alive 24/7 (high CPU cost).

**Independent Test**: Verify Network tab shows regular polling requests that return quickly (not persistent connections).

**Acceptance Scenarios**:

1. **Given** a menu display is polling, **When** menu content has not changed, **Then** cached responses are served from edge (no CPU cost)
2. **Given** 20 displays are polling, **When** 1 hour passes, **Then** most requests hit edge cache (minimal function invocations)

---

### User Story 3 - Fast Initial Page Loads (Priority: P2)

All pages should load quickly using cached data while still respecting Payload updates.

**Why this priority**: User experience - pages should feel instant.

**Independent Test**: Measure Time to First Byte (TTFB) on homepage and beer pages.

**Acceptance Scenarios**:

1. **Given** data is cached, **When** user visits homepage, **Then** page serves from cache (TTFB < 200ms on Vercel)
2. **Given** admin updates a beer description, **When** user visits that beer's page, **Then** new description appears (cache invalidated by Payload hook)

---

### User Story 4 - Content Updates Propagate Site-Wide (Priority: P3)

When beers, locations, events, or other content changes in Payload, all affected pages should receive fresh data.

**Why this priority**: Data consistency across the site.

**Independent Test**: Update a beer's style → verify beer listing page, individual beer page, and menus all show updated style.

**Acceptance Scenarios**:

1. **Given** a beer exists on multiple menus, **When** beer name is changed, **Then** all menu pages show new name
2. **Given** a location's hours change, **When** user visits homepage, **Then** updated hours are displayed

---

### Edge Cases

- What happens when Payload is unavailable? → Cached data continues to serve; SSE gracefully handles errors and reconnects
- What if a menu URL changes? → Old URL returns 404; new URL works immediately
- What happens during deployment? → ISR fallback ensures pages serve stale-while-revalidate
- What if SSE connection drops? → Client auto-reconnects after 1 second
- What if admin tries to add duplicate beer to menu? → Validation error: "Duplicate beer detected - each beer can only appear once on the menu"
- What if a beer is removed then re-added quickly? → Exit animation cancelled, beer animates in as new entry

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST invalidate relevant Next.js cache tags when Payload content changes
- **FR-002**: System MUST use `unstable_cache` with tags for all Payload data fetching functions
- **FR-003**: Menu pages MUST poll a cached endpoint for real-time updates
- **FR-004**: Menu endpoint MUST return cached responses (edge cache) for cost efficiency
- **FR-005**: Payload afterChange hook MUST trigger cache revalidation when menu is updated
- **FR-006**: System MUST have ISR fallback times for all cached pages
- **FR-007**: Revalidation endpoint MUST be secured with REVALIDATE_SECRET token
- **FR-008**: Menu items MUST animate on enter (slide from right + scale bounce) and exit (slide left + fade)
- **FR-009**: Menu collection MUST prevent duplicate beers via beforeValidate hook
- **FR-010**: Animation hook MUST handle rapid add/remove cycles without duplicate key errors

### Key Entities

- **Cache Tags**: Logical tags (`beers`, `menus`, `events`, etc.) that group cached data
- **Revalidation Endpoint**: `/api/revalidate/menu` - called by Payload afterChange hook to invalidate cache
- **ISR Revalidate Times**: Fallback refresh intervals per page type

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Menu changes in Payload are visible on display screens within 2-3 seconds
- **SC-002**: Polling requests return cached responses (x-vercel-cache: HIT) when menu unchanged
- **SC-003**: Homepage TTFB under 300ms on Vercel (cached)
- **SC-004**: Vercel "Fluid Active CPU" stays minimal (cached responses don't use CPU)
- **SC-005**: All Payload collections trigger appropriate cache invalidation on change

## Implementation Summary

### Architecture

```
┌─────────────────┐     afterChange hook     ┌─────────────────┐
│  Payload CMS    │ ─────────────────────────▶│ /api/revalidate │
│  (Menus)        │                           │     /menu       │
└─────────────────┘                           └─────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │ revalidateTag() │
                                              │   (menus tag)   │
                                              └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐     poll every 2s         ┌─────────────────┐
│  Menu Displays  │ ─────────────────────────▶│ /api/menu-stream│
│  (Browser)      │                           │   (cached JSON) │
└─────────────────┘                           └─────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │  Edge Cache     │
                                              │  (HIT = free)   │
                                              └─────────────────┘
```

### Why Cached Polling over SSE?

**Problem with SSE on Vercel**: SSE keeps serverless functions alive continuously, consuming "Fluid Active CPU" even when idle. With 4+ displays running 24/7, this became expensive.

| Approach | CPU Usage | Cost |
|----------|-----------|------|
| **SSE (old)** | Continuous (functions stay alive) | High |
| **Cached Polling (new)** | Only on cache MISS | Very Low |

**How cached polling works**:
1. Client polls `/api/menu-stream/[url]` every 2 seconds
2. Endpoint returns cached JSON (edge cache HIT = no CPU)
3. When menu is saved in Payload, afterChange hook calls `/api/revalidate/menu`
4. Revalidation invalidates cache tag
5. Next poll gets fresh data (cache MISS = one DB query)
6. Subsequent polls hit cache again

**Result**: 99%+ of requests hit edge cache (nearly free). Only actual menu changes trigger function execution.

### Files Created

| File | Purpose |
|------|---------|
| `lib/utils/cache.ts` | Cache tag constants and utilities |
| `src/plugins/revalidation-plugin.ts` | Centralized Payload revalidation hooks |
| `src/app/api/menu-stream/[url]/route.ts` | Cached JSON endpoint for menu polling |
| `src/app/api/revalidate/menu/route.ts` | Revalidation endpoint called by Payload hook |
| `src/hooks/revalidate-menu.ts` | Payload afterChange hook for cache invalidation |
| `lib/hooks/use-menu-stream.ts` | Client-side polling hook |
| `lib/hooks/use-animated-list.ts` | Tracks item enter/exit states for CSS animations |
| `components/menu/live-menu.tsx` | Live-updating menu display component |

### Files Modified

| File | Changes |
|------|---------|
| `src/payload.config.ts` | Added revalidationPlugin |
| `lib/utils/payload-api.ts` | Replaced React cache() with unstable_cache + tags |
| `src/app/api/menu-by-url/[url]/route.ts` | Added ETag support for conditional requests |
| `src/app/(frontend)/m/[menuUrl]/page.tsx` | Uses LiveMenu component with polling |
| `src/app/(frontend)/page.tsx` | Added `revalidate = 300` |
| `src/app/(frontend)/beer/page.tsx` | Added `revalidate = 3600` |
| `src/app/(frontend)/events/page.tsx` | Added `revalidate = 300` |
| `src/app/(frontend)/globals.css` | Added menu-item-enter/exit CSS keyframe animations |
| `components/home/featured-menu.tsx` | Added `animated` prop and animation class application |
| `src/collections/Menus.ts` | Added afterChange hook for cache revalidation, beforeValidate for duplicate prevention |
| `src/collections/Beers.ts` | Added `justReleased` checkbox for manual "Just Released" flag |
| `components/beer/draft-beer-card.tsx` | Added `showTapAndPrice` prop, zebra striping for TV menu displays |
| `lib/types/beer.ts` | Added `tap` property to Beer interface |
| `components/beer/beer-map-content.tsx` | Accept weeklyHours prop for server-fetched cached data |
| `src/app/(frontend)/beer-map/page.tsx` | Server-side hours fetching using cached payload-api |

### Cache Tag Mapping

| Collection | Tags Invalidated | Paths Revalidated |
|------------|------------------|-------------------|
| `beers` | beers, menus | `/`, `/beer`, `/beer/[slug]` |
| `menus` | menus | `/`, `/m/[url]` |
| `events` | events | `/`, `/events` |
| `food` | food | `/`, `/food` |
| `locations` | locations, menus | `/` |
| `holiday-hours` | holiday-hours, locations | `/` |
| `styles` | styles, beers | `/beer` |

### ISR Fallback Times

| Page | Revalidate Time | Rationale |
|------|-----------------|-----------|
| Homepage (`/`) | 300s (5 min) | Balance freshness with performance |
| Beer listing (`/beer`) | 3600s (1 hr) | Beer catalog changes infrequently |
| Menu display (`/m/[url]`) | 60s (1 min) | Polling handles real-time; ISR is fallback |
| Menu API (`/api/menu-stream`) | 2s edge + 60s data | Edge cache + on-demand revalidation |
| Events (`/events`) | 300s (5 min) | Events are time-sensitive |

### Polling Lifecycle

```
Browser                          Server                         Payload Admin
   │                                │                                │
   │──── GET /api/menu-stream/x ───▶│                                │
   │◀─── JSON (cached) ─────────────│  ← Edge cache HIT              │
   │                                │                                │
   │  [2 seconds later]             │                                │
   │                                │                                │
   │──── GET /api/menu-stream/x ───▶│                                │
   │◀─── JSON (cached) ─────────────│  ← Edge cache HIT              │
   │                                │                                │
   │                                │     [admin saves menu] ────────│
   │                                │                                │
   │                                │◀─── POST /api/revalidate/menu ─│
   │                                │     revalidateTag('menus')     │
   │                                │                                │
   │  [2 seconds later]             │                                │
   │                                │                                │
   │──── GET /api/menu-stream/x ───▶│                                │
   │◀─── JSON (fresh) ──────────────│  ← Cache MISS, DB query        │
   │                                │                                │
   │  [2 seconds later]             │                                │
   │                                │                                │
   │──── GET /api/menu-stream/x ───▶│                                │
   │◀─── JSON (cached) ─────────────│  ← Edge cache HIT              │
   │                                │                                │
```

### Menu Item Animations

CSS-based animations using `useAnimatedList` hook:

| State | Animation | Duration |
|-------|-----------|----------|
| **Entering** | Slide from right (150px) + scale 0.8→1.02→1 + fade in | 0.6s with spring bounce |
| **Exiting** | Pull back + slide left (150px) + scale to 0.8 + fade out | 0.5s |
| **Stable** | Smooth transitions enabled | - |

**Animation Hook Design:**
- Animation state lives ONLY in React state (no drift between refs and state)
- Timeouts tracked and cleared to prevent race conditions
- Functional state updates (`prev => ...`) avoid stale closures
- Exit timeouts cancelled when items return quickly

```css
/* Key animations in globals.css */
@keyframes menu-item-enter {
  0% { opacity: 0; transform: translateX(150px) scale(0.8); }
  60% { opacity: 1; transform: translateX(-10px) scale(1.02); }
  100% { opacity: 1; transform: translateX(0) scale(1); }
}

@keyframes menu-item-exit {
  0% { opacity: 1; transform: translateX(0) scale(1); }
  40% { opacity: 0.8; transform: translateX(10px) scale(0.98); }
  100% { opacity: 0; transform: translateX(-150px) scale(0.8); }
}
```

## Known Limitations

### Beer Content Changes Require Menu Save

**Issue**: If a beer's details (name, description, image, price on the beer record) are edited without modifying the menu itself, the menu cache is not invalidated.

**Workaround**: After editing a beer, touch the menu (reorder items or republish) to trigger cache revalidation.

**Future fix**: Add afterChange hook to Beers collection that also revalidates menus cache tag.

### Environment Variable Required for Production

**Issue**: The revalidation endpoint should be secured with `REVALIDATE_SECRET` env var.

**Setup**: Add `REVALIDATE_SECRET` to Vercel environment variables with a random string. The Payload hook will send this token in the `x-revalidate-token` header.

### Duplicate Beer Validation

**Issue**: The `beforeValidate` hook in Menus.ts should prevent duplicate beers, but edge cases may exist where duplicates slip through (possibly related to draft/publish workflow or relationship population timing).

**Status**: Under investigation - validation should work but user reported adding duplicate beers without error.
