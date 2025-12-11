# Feature Specification: Caching and Live Menu Updates

**Feature Branch**: `payload`
**Created**: 2024-12-10
**Updated**: 2024-12-11
**Status**: Implemented (with known limitations)
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

Menu displays (TVs in taproom) should receive updates efficiently without excessive bandwidth or server load, staying within Vercel free tier limits.

**Why this priority**: 20+ displays running 24/7 need to be resource-efficient and stay within free tier (100K requests/month).

**Independent Test**: Verify SSE connections in Network tab - should show single persistent connection per display.

**Acceptance Scenarios**:

1. **Given** a menu display is connected via SSE, **When** menu content has not changed, **Then** only heartbeat messages are sent (minimal bandwidth)
2. **Given** 20 displays are connected, **When** 1 hour passes, **Then** total Vercel requests stay minimal (reconnects only)

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
- **FR-003**: Menu pages MUST use Server-Sent Events (SSE) for real-time updates
- **FR-004**: SSE endpoint MUST check for changes every 5 seconds server-side
- **FR-005**: SSE client MUST auto-reconnect on connection drop (Vercel 30s timeout)
- **FR-006**: System MUST have ISR fallback times for all cached pages
- **FR-007**: Revalidation hooks MUST be centralized in a Payload plugin (not scattered across collections)
- **FR-008**: Menu items MUST animate on enter (slide from right + scale bounce) and exit (slide left + fade)
- **FR-009**: Menu collection MUST prevent duplicate beers via beforeValidate hook
- **FR-010**: Animation hook MUST handle rapid add/remove cycles without duplicate key errors

### Key Entities

- **Cache Tags**: Logical tags (`beers`, `menus`, `events`, etc.) that group cached data
- **SSE Stream**: Server-Sent Events connection for real-time menu updates
- **ISR Revalidate Times**: Fallback refresh intervals per page type

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Menu changes in Payload are visible on display screens within 5 seconds
- **SC-002**: SSE connections show single persistent connection per display (not repeated requests)
- **SC-003**: Homepage TTFB under 300ms on Vercel (cached)
- **SC-004**: 20 displays stay within Vercel free tier limits (100K requests/month)
- **SC-005**: All Payload collections trigger appropriate cache invalidation on change

## Implementation Summary

### Architecture

```
┌─────────────────┐     afterChange hook     ┌─────────────────┐
│  Payload CMS    │ ─────────────────────────▶│ revalidateTag() │
│  (Collections)  │                           │ revalidatePath()│
└─────────────────┘                           └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐     unstable_cache        ┌─────────────────┐
│  Data Fetching  │ ◀─────────────────────────│   Next.js       │
│  (payload-api)  │       with tags           │   Data Cache    │
└─────────────────┘                           └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐     Server-Sent Events    ┌─────────────────┐
│  Menu Displays  │ ◀─────────────────────────│   SSE Endpoint  │
│  (Browser)      │   (persistent connection) │   (5s polling)  │
└─────────────────┘                           └─────────────────┘
```

### Why SSE over Polling?

| Approach | Requests/month (20 displays) | Free Tier Fit |
|----------|------------------------------|---------------|
| Polling (5s) | ~5.2M | ❌ Way over |
| Polling (30s) | ~864K | ❌ Over by 8x |
| Polling (5min) | ~86K | ✅ Fits |
| **SSE** | ~40K (reconnects only) | ✅ **Best** |

SSE uses a single persistent connection per display. The server checks for changes every 5 seconds internally, but this doesn't count as Vercel requests - only the initial connection and reconnects do.

### Files Created

| File | Purpose |
|------|---------|
| `lib/utils/cache.ts` | Cache tag constants and utilities |
| `src/plugins/revalidation-plugin.ts` | Centralized Payload revalidation hooks |
| `src/app/api/menu-stream/[url]/route.ts` | SSE endpoint for real-time menu updates |
| `lib/hooks/use-menu-stream.ts` | Client-side SSE hook with auto-reconnect |
| `lib/hooks/use-menu-polling.ts` | Client-side polling hook (fallback/alternative) |
| `lib/hooks/use-animated-list.ts` | Tracks item enter/exit states for CSS animations |
| `components/menu/live-menu.tsx` | Live-updating menu display component |

### Files Modified

| File | Changes |
|------|---------|
| `src/payload.config.ts` | Added revalidationPlugin |
| `lib/utils/payload-api.ts` | Replaced React cache() with unstable_cache + tags |
| `src/app/api/menu-by-url/[url]/route.ts` | Added ETag support for conditional requests |
| `src/app/(frontend)/m/[menuUrl]/page.tsx` | Uses LiveMenu component with SSE |
| `src/app/(frontend)/page.tsx` | Added `revalidate = 300` |
| `src/app/(frontend)/beer/page.tsx` | Added `revalidate = 3600` |
| `src/app/(frontend)/events/page.tsx` | Added `revalidate = 300` |
| `src/app/(frontend)/globals.css` | Added menu-item-enter/exit CSS keyframe animations |
| `components/home/featured-menu.tsx` | Added `animated` prop and animation class application |
| `src/collections/Menus.ts` | Added beforeValidate hook to prevent duplicate beers |
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
| Menu display (`/m/[url]`) | 60s (1 min) | SSE handles real-time; ISR is fallback |
| Events (`/events`) | 300s (5 min) | Events are time-sensitive |

### SSE Connection Lifecycle

```
Browser                          Server
   │                                │
   │──── GET /api/menu-stream/x ───▶│
   │                                │
   │◀─── event: menu (full data) ───│
   │                                │
   │◀─── : heartbeat ───────────────│  (every 5s)
   │◀─── : heartbeat ───────────────│
   │                                │
   │     [menu updated in Payload]  │
   │                                │
   │◀─── event: menu (new data) ────│
   │                                │
   │◀─── : heartbeat ───────────────│
   │                                │
   │     [Vercel 30s timeout]       │
   │                                │
   │──── reconnect ─────────────────▶│
   │◀─── event: menu (current) ─────│
   │                                │
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

### SSE Does Not Detect Beer Content Changes

**Issue**: The SSE endpoint's change detection hash only checks `menu.updatedAt` and `menu.items.length`. If a beer's details (name, description, image, price on the beer record) are edited without modifying the menu itself, SSE will not push an update.

**Current behavior**:
```ts
// Only detects menu document changes, not nested beer changes
const content = `${menu.updatedAt || ''}-${menu.items?.length || 0}`
```

**Workaround**: After editing a beer, touch the menu (reorder items or republish) to trigger an update.

**Future fix**: Hash should include beer `updatedAt` timestamps or use Payload's afterChange hook on beers to notify connected menu streams.

### Duplicate Beer Validation

**Issue**: The `beforeValidate` hook in Menus.ts should prevent duplicate beers, but edge cases may exist where duplicates slip through (possibly related to draft/publish workflow or relationship population timing).

**Validation logic** (Menus.ts lines 42-59):
```ts
beforeValidate: [
  ({ data }) => {
    const beerIds = data.items?.map(item =>
      typeof item.beer === 'string' ? item.beer : item.beer?.id
    ).filter(Boolean)

    if (new Set(beerIds).size !== beerIds.length) {
      throw new APIError('Duplicate beer detected...', 400)
    }
  }
]
```

**Status**: Under investigation - validation should work but user reported adding duplicate beers without error.
