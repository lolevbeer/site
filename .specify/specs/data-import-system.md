# Feature Specification: Data Import System

**Feature Branch**: `payload`
**Created**: 2026-01-02
**Updated**: 2026-01-05
**Status**: Implemented
**Input**: Multi-source data import for brewery content (Google Sheets, CSV, JSON APIs)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sync Events from Google Sheets (Priority: P1)

As an admin, I want to import events from Google Sheets so that event managers can use a familiar interface.

**Why this priority**: Workflow integration - event managers prefer spreadsheets over CMS.

**Independent Test**: Open /admin/sync, click Sync Events, verify events appear in Events collection.

**Acceptance Scenarios**:

1. **Given** an admin on the sync page, **When** they click "Sync Events", **Then** events are imported with real-time progress
2. **Given** new events in Google Sheets, **When** sync runs, **Then** new events are created in Payload
3. **Given** updated events in Google Sheets, **When** sync runs, **Then** existing events are updated with changes
4. **Given** dry-run mode enabled, **When** sync runs, **Then** changes are previewed without database writes

---

### User Story 2 - Import Food Vendors from CSV (Priority: P2)

As an admin, I want to upload a CSV file of food vendors so that I can bulk-add vendors.

**Why this priority**: Efficiency - faster than creating vendors one-by-one.

**Independent Test**: Upload food-vendors.csv, verify vendors appear in Food Vendors collection.

**Acceptance Scenarios**:

1. **Given** an admin with a CSV file, **When** they upload to the import endpoint, **Then** vendors are created
2. **Given** a CSV with duplicate vendor names, **When** import runs, **Then** duplicates are skipped with count
3. **Given** a CSV with invalid data, **When** import runs, **Then** errors are reported per row

---

### User Story 3 - Import Distributors from API (Priority: P2)

As an admin, I want to import distributors from third-party JSON feeds so that retailer data stays current.

**Why this priority**: Data maintenance - distributor lists change frequently.

**Independent Test**: Configure PA distributor URL, click Import, verify distributors are geocoded and added.

**Acceptance Scenarios**:

1. **Given** an admin with configured feed URLs, **When** they click "Import PA", **Then** PA distributors are fetched and geocoded
2. **Given** distributors without coordinates, **When** import runs, **Then** addresses are geocoded via Nominatim/Bing
3. **Given** geocoding rate limits, **When** import runs, **Then** 1.1s delays between requests prevent quota issues

---

### Edge Cases

- What happens when Google Sheet is unavailable? Error returned with message
- What happens when CSV has malformed rows? Row-level errors reported, valid rows imported
- What happens when geocoding fails for all addresses? Regional fallback coordinates used

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST import Events from Google Sheets CSV export
- **FR-002**: System MUST import Food from Google Sheets CSV export
- **FR-003**: System MUST import Food Vendors from uploaded CSV files
- **FR-004**: System MUST import Distributors from Sixth City/Encompass8 JSON API
- **FR-005**: System MUST import Lake Beverage distributors from uploaded CSV
- **FR-006**: System MUST provide dry-run mode for all import operations
- **FR-007**: System MUST stream progress via Server-Sent Events
- **FR-008**: System MUST detect and skip duplicate records

### Key Entities

- **Import Source**: Google Sheets, CSV file, JSON API
- **Import Target**: Events, Food, Food Vendors, Distributors
- **Progress Event**: SSE message with status, count, and details

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Google Sheets sync completes in under 30 seconds for 100 records
- **SC-002**: CSV import provides row-level error reporting
- **SC-003**: Distributor import successfully geocodes 95%+ of addresses
- **SC-004**: Dry-run mode accurately previews all changes

## Implementation Summary

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Google Sheets  │     │  CSV Upload     │     │  JSON API       │
│  (Published)    │     │  (Multipart)    │     │  (Sixth City)   │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Import Endpoints                              │
│  - sync-google-sheets    - import-food-vendors-csv              │
│  - import-distributors   - import-lake-beverage-csv             │
└─────────────────────────────────────────────────────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Payload CMS Collections                       │
│  Events | Food | FoodVendors | Distributors | Beers | Menus     │
└─────────────────────────────────────────────────────────────────┘
```

### Files Created/Modified

**Endpoints:**
| File | Purpose |
|------|---------|
| `/src/endpoints/sync-google-sheets.ts` | Events/Food/Beers/Menus sync |
| `/src/endpoints/import-food-vendors-csv.ts` | Food vendor CSV import |
| `/src/endpoints/import-distributors.ts` | PA/OH distributor import |
| `/src/endpoints/import-lake-beverage-csv.ts` | NY distributor CSV import |
| `/src/endpoints/geocode.ts` | Address geocoding utilities |

**Scripts:**
| File | Purpose |
|------|---------|
| `/scripts/import-from-google-sheets.ts` | CLI tool for Events/Food |
| `/scripts/import-food-vendors.ts` | CLI tool for vendor CSV |
| `/scripts/import-ohio-distributors.ts` | CLI tool for PA/OH distributors |
| `/scripts/generate-beer-data.ts` | Beer data generation from CSV |

**Admin UI:**
| File | Purpose |
|------|---------|
| `/src/components/SyncViewClient.tsx` | Import UI with progress display |

### SSE Progress Format

```typescript
// Progress event
event: progress
data: {"type":"progress","current":5,"total":100,"message":"Processing event: Trivia Night"}

// Complete event
event: complete
data: {"type":"complete","created":10,"updated":5,"skipped":2,"errors":0}
```

### Authentication

All endpoints require authenticated user with appropriate role:
- `admin`: All imports
- `food-manager`: Food vendor import only
