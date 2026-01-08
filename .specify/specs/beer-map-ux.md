# Feature Specification: Beer Map UX & Performance

**Feature Branch**: `payload`
**Created**: 2026-01-02
**Updated**: 2026-01-05
**Status**: Implemented
**Input**: Interactive distributor map with search, geolocation, and responsive split-view design

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search for Nearby Locations (Priority: P1)

A visitor wants to find where to buy LOLEV beer near a specific address or their current location.

**Why this priority**: Core functionality - enables customers to find retail locations.

**Independent Test**: Navigate to /beer-map, search "15213", verify Pittsburgh locations appear sorted by distance.

**Acceptance Scenarios**:

1. **Given** a visitor on the beer-map page, **When** they search for a zipcode, **Then** nearby distributors are displayed sorted by distance
2. **Given** a visitor on the beer-map page, **When** they search for an address, **Then** map centers on that location with nearby results
3. **Given** a visitor on the beer-map page, **When** they click "Near Me", **Then** browser requests location and shows nearby distributors

---

### User Story 2 - Interactive Map Experience (Priority: P1)

A visitor wants to explore the map and click locations to see details.

**Why this priority**: Engagement - visual exploration is intuitive for location finding.

**Independent Test**: Click a map marker, verify popup appears and list scrolls to that card.

**Acceptance Scenarios**:

1. **Given** a visitor viewing the map, **When** they click a marker, **Then** the location card is highlighted in the list
2. **Given** a visitor viewing the list, **When** they click a card, **Then** the map flies to that location
3. **Given** a visitor viewing the map, **When** they hover over a marker, **Then** cursor changes to pointer

---

### User Story 3 - Mobile Responsive Design (Priority: P2)

A visitor on mobile wants to easily switch between map and list views.

**Why this priority**: Accessibility - mobile users are a significant portion of traffic.

**Independent Test**: View /beer-map on mobile, verify toggle between map-only and list-only views.

**Acceptance Scenarios**:

1. **Given** a visitor on mobile, **When** they view the page, **Then** they see a toggle for map/list views
2. **Given** a visitor on mobile in list view, **When** they click "Show Map", **Then** full-screen map appears
3. **Given** a visitor on mobile in map view, **When** they click "Show List", **Then** scrollable list appears

---

### Edge Cases

- What happens when search returns no results? "No locations found" message displayed
- What happens when geolocation is denied? Toast notification with fallback to manual search
- What happens with 1000+ locations? List capped at 50 with "showing X of Y" notice

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display distributors on an interactive Mapbox map
- **FR-002**: System MUST support search by address, zipcode, or location name
- **FR-003**: System MUST calculate distances using Haversine formula
- **FR-004**: System MUST support browser geolocation for "Near Me"
- **FR-005**: System MUST provide split-view (map + list) on desktop
- **FR-006**: System MUST provide toggle view (map or list) on mobile
- **FR-007**: System MUST sync map selection with list highlighting
- **FR-008**: System MUST lazy-load map component (no SSR)

### Key Entities

- **Distributor**: Location with name, address, coordinates, contact info
- **Reference Point**: Search location or user's current location
- **Distance**: Calculated miles from reference point

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Map loads in under 2 seconds on desktop
- **SC-002**: Search results appear within 500ms of typing
- **SC-003**: Distance calculations accurate within 0.1 miles
- **SC-004**: Mobile toggle responds instantly (<100ms)

## Implementation Summary

### Architecture

```
┌─────────────────┐     SSR Data Fetch     ┌─────────────────┐
│  Page Component │ ──────────────────────▶│  Payload API    │
│  (Server)       │                        │  (Distributors) │
└────────┬────────┘                        └─────────────────┘
         │
         ▼ Props
┌─────────────────┐     Mapbox GL          ┌─────────────────┐
│  DistributorMap │ ◀────────────────────▶ │  Mapbox Tiles   │
│  (Client)       │                        │  (Dark/Light)   │
└─────────────────┘                        └─────────────────┘
```

### Performance Optimizations

1. **Dynamic Import**: Map component loaded client-side only
2. **SSR Data Fetch**: Distributors fetched server-side, passed as props
3. **useMemo**: Distance calculations, list filtering, GeoJSON generation
4. **WebGL Rendering**: Mapbox GL for thousands of points
5. **Debounced Search**: 800ms delay prevents excessive API calls
6. **List Cap**: Maximum 50 items displayed with pagination notice

### Files Created/Modified

| File | Purpose |
|------|---------|
| `/components/ui/distributor-map.tsx` | Core map component (553 lines) |
| `/components/beer/beer-map-content.tsx` | Page wrapper with lazy loading |
| `/src/app/(frontend)/beer-map/page.tsx` | SSR data fetching |
| `/components/map/map-controls.tsx` | Search bar and controls |
| `/components/map/location-card.tsx` | List item card |
| `/lib/hooks/use-map-data.ts` | Data fetching hook |
| `/lib/hooks/use-geolocation.ts` | Browser geolocation wrapper |
| `/lib/hooks/use-location-search.ts` | Mapbox geocoding |

### Configuration

```typescript
const MAP_CONFIG = {
  DEFAULT_CENTER: { latitude: 40.5285, longitude: -80.2456 },
  DEFAULT_ZOOM: 7,
  LOCATION_ZOOM: 12,
  DETAIL_ZOOM: 14,
  EARTH_RADIUS_MILES: 3959,
  NEARBY_PREVIEW_COUNT: 3,
  MAX_LIST_ITEMS: 50,
}

const SEARCH_DEBOUNCE = 800 // ms
```

### Distance Calculation (Haversine)

```typescript
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959 // Earth radius in miles
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}
```

### Theme Integration

- Dark mode: `mapbox://styles/mapbox/dark-v11`
- Light mode: `mapbox://styles/mapbox/light-v11`
- Marker colors adapt to theme
