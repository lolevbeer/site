# Feature Specification: Distributor Map & Regeocode

**Feature Branch**: `payload`
**Created**: 2026-01-02
**Updated**: 2026-01-05
**Status**: Implemented
**Input**: Interactive map for finding distributor locations with geocoding maintenance tools

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find Nearby Distributors (Priority: P1)

A visitor wants to find where they can purchase LOLEV beer near their location.

**Why this priority**: Core value proposition - enables customers to find retail locations.

**Independent Test**: Navigate to /beer-map, search for an address, verify nearby distributors are displayed with distances.

**Acceptance Scenarios**:

1. **Given** a visitor on the beer-map page, **When** they search for "Pittsburgh, PA", **Then** distributors near Pittsburgh are displayed sorted by distance
2. **Given** a visitor on the beer-map page, **When** they click "Near Me", **Then** browser requests location permission and shows nearby distributors
3. **Given** a visitor viewing the map, **When** they click a map marker, **Then** the location card is highlighted and scrolled into view
4. **Given** a visitor viewing the list, **When** they click a location card, **Then** the map flies to that location

---

### User Story 2 - Import Distributors from Data Feeds (Priority: P2)

As an admin, I want to import distributor data from third-party feeds so that the map stays current.

**Why this priority**: Data maintenance - distributors change frequently and manual entry is error-prone.

**Independent Test**: Open /admin/sync, enter PA distributor URL, click Import, verify new distributors appear.

**Acceptance Scenarios**:

1. **Given** an admin on the sync page, **When** they import PA distributors, **Then** new distributors are geocoded and added to the database
2. **Given** an admin importing distributors, **When** geocoding fails, **Then** regional fallback coordinates are used
3. **Given** an admin importing distributors, **When** a duplicate name exists, **Then** the distributor is skipped

---

### User Story 3 - Fix Bad Coordinates (Priority: P3)

As an admin, I want to identify and fix distributors with default/fallback coordinates so that all locations are accurate.

**Why this priority**: Data quality - ensures map accuracy after bulk imports.

**Independent Test**: Run regeocode dry-run, verify suspicious coordinates are identified, run fix, verify coordinates are updated.

**Acceptance Scenarios**:

1. **Given** an admin on the sync page, **When** they click "Find Bad Coords", **Then** distributors with fallback coordinates are listed
2. **Given** an admin with bad coordinates identified, **When** they click "Fix Bad Coords", **Then** addresses are re-geocoded with real-time progress
3. **Given** a distributor with `halfPourOnly` coordinates, **When** regeocode runs, **Then** Nominatim is tried first, then Bing Maps fallback

---

### Edge Cases

- What happens when geocoding quota is exceeded? Rate limiting (600ms between requests) prevents quota issues
- What happens when address is ambiguous? Multiple geocoding strategies with fallback to zip code
- What happens when map style fails to load? Graceful fallback to default Mapbox style

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display distributors on an interactive Mapbox map
- **FR-002**: System MUST support search by address, zipcode, or location name
- **FR-003**: System MUST calculate and display distances from search location
- **FR-004**: System MUST support browser geolocation for "Near Me" functionality
- **FR-005**: System MUST import distributors from Sixth City/Encompass8 JSON feeds
- **FR-006**: System MUST geocode addresses using Nominatim (primary) and Bing Maps (fallback)
- **FR-007**: System MUST identify distributors with suspicious default coordinates
- **FR-008**: System MUST re-geocode distributors with real-time progress streaming

### Key Entities

- **Distributor**: Location record with name, address, coordinates, customer type, region
- **GeoJSON Point**: Coordinate storage format `[longitude, latitude]`
- **Default Coordinates**: Regional fallback coordinates (Pittsburgh PA, Columbus OH, Rochester NY)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Map displays all active distributors with correct marker positions
- **SC-002**: Search returns relevant results within 500ms
- **SC-003**: Distance calculations accurate within 0.1 miles
- **SC-004**: Regeocode identifies 100% of distributors with default coordinates
- **SC-005**: Import processes 100+ distributors without timeout

## Implementation Summary

### Architecture

```
┌─────────────────┐     Import/Geocode      ┌─────────────────┐
│  Sixth City/    │ ──────────────────────▶ │  Payload CMS    │
│  Encompass8 API │                         │  (Distributors) │
└─────────────────┘                         └─────────────────┘
                                                    │
                                                    ▼
┌─────────────────┐     Mapbox GL           ┌─────────────────┐
│  Beer Map Page  │ ◀────────────────────── │  GeoJSON Data   │
│  (Browser)      │                         │  (API Response) │
└─────────────────┘                         └─────────────────┘
```

### Files Created/Modified

| File | Purpose |
|------|---------|
| `/components/ui/distributor-map.tsx` | Interactive Mapbox map component |
| `/src/endpoints/regeocode-distributors.ts` | Coordinate correction endpoint |
| `/src/endpoints/import-distributors.ts` | Distributor import from JSON feeds |
| `/src/endpoints/geocode.ts` | Geocoding utilities (Nominatim + Bing) |
| `/src/collections/Distributors.ts` | Payload CMS collection definition |
| `/lib/hooks/use-map-data.ts` | Hook for fetching distributor data |

### Default Coordinate Detection

Regional fallback coordinates (tolerance: 0.0001 ~ 10 meters):
- PA: Pittsburgh (-79.9959, 40.4406)
- OH: Columbus (-82.9988, 39.9612)
- NY: Rochester (-77.6109, 43.1566)
- WV: Pittsburgh fallback
