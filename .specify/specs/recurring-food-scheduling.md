# Feature Specification: Recurring Food Scheduling

**Feature Branch**: `payload` (current branch)
**Created**: 2026-01-02
**Updated**: 2026-01-04
**Status**: Implemented (Refactored)
**Input**: User description: "A global for managing recurring food vendor schedules by week occurrence (1st-5th) and day of week, with dynamic location tabs from the database, a custom grid UI component, exclusion dates with vendor preview, and inline vendor creation"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Schedule Recurring Food Vendors (Priority: P1)

As a brewery manager, I want to schedule recurring food vendors for specific days and week occurrences so that customers know which food vendor will be available on any given date.

**Why this priority**: Core functionality - without this, the feature has no value. Managers need to set up the recurring schedule before anything else can work.

**Independent Test**: Can be fully tested by opening the Recurring Food global in Payload admin, selecting a vendor for "1st Monday" at Lawrenceville, saving, and verifying the data persists.

**Acceptance Scenarios**:

1. **Given** I am on the Recurring Food global in Payload admin, **When** I select a food vendor for "1st week, Monday" at any location, **Then** the vendor is saved and displayed in that grid cell
2. **Given** I have set a vendor for "2nd Friday" at a location, **When** I navigate away and return, **Then** the vendor selection persists
3. **Given** I am viewing any location tab, **When** I look at the grid, **Then** I see days (Sun-Sat) as columns and weeks (1st-5th) as rows
4. **Given** a new location is added to the Locations collection, **When** I open the Recurring Food global, **Then** a new tab appears for that location automatically

---

### User Story 2 - Manage Food Vendors Collection (Priority: P1)

As a brewery manager, I want to maintain a collection of food vendors with their details so that I can easily assign them to recurring schedules and one-off events.

**Why this priority**: Required for the scheduling feature to work - vendors must exist before they can be scheduled.

**Independent Test**: Can be fully tested by creating a new food vendor with name, website, and logo, then verifying it appears in vendor selection dropdowns.

**Acceptance Scenarios**:

1. **Given** I am in the Food Vendors collection, **When** I create a new vendor with name "Pittsburgh Pierogi", **Then** the vendor is saved and available for selection
2. **Given** I am scheduling a recurring food slot, **When** I click the vendor dropdown, **Then** I see all existing vendors listed
3. **Given** I am scheduling a recurring food slot, **When** I click "Add new" in the vendor selector, **Then** I can create a new vendor inline without leaving the page

---

### User Story 3 - Add Exclusion Dates (Priority: P2)

As a brewery manager, I want to mark specific dates when recurring vendors will NOT be present so that the system doesn't display them on holidays or special occasions.

**Why this priority**: Important for accuracy but schedule setup must come first. Exclusions refine the schedule.

**Independent Test**: Can be fully tested by adding an exclusion for a specific date, then verifying the system recognizes that date as excluded.

**Acceptance Scenarios**:

1. **Given** I am on the Exclusions tab, **When** I add an exclusion for "December 25, 2026", **Then** the exclusion is saved
2. **Given** I have a vendor scheduled for "2nd Wednesday", **When** I select a date that falls on "2nd Wednesday", **Then** the system shows which vendor(s) will be excluded
3. **Given** I add an exclusion with a specific location, **When** I save, **Then** only that location's vendor is excluded for that date

---

### User Story 4 - View Scheduled Vendor Preview on Exclusions (Priority: P3)

As a brewery manager, I want to see which vendors are scheduled for a date when creating an exclusion so that I can verify I'm excluding the correct event.

**Why this priority**: Quality-of-life improvement that helps prevent errors but isn't essential for basic functionality.

**Independent Test**: Can be fully tested by selecting a date in the exclusion form and verifying the preview shows the correct scheduled vendor.

**Acceptance Scenarios**:

1. **Given** I have "Pizza Co" scheduled for "1st Saturday" at Lawrenceville, **When** I select a date that is the 1st Saturday of a month in the exclusion form, **Then** I see "Will exclude: Pizza Co @ Lawrenceville"
2. **Given** no vendor is scheduled for "3rd Tuesday", **When** I select a date that is the 3rd Tuesday, **Then** I see "No recurring food scheduled for this date"

---

### Edge Cases

- What happens when a month has a 5th occurrence of a day (e.g., 5th Saturday)? The system supports 5th week scheduling.
- What happens when a vendor is deleted that has recurring schedules? The relationship becomes null/empty in the grid.
- What happens when an exclusion is added for a date with no scheduled vendor? The system shows "No recurring food scheduled for this date" but still allows the exclusion.
- What happens when both locations have the same vendor scheduled for the same day/week? Each location is independent; both will show in vendor preview.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a global "Recurring Food" configuration in Payload admin
- **FR-002**: System MUST dynamically generate location tabs from the active Locations collection (no hardcoded locations)
- **FR-003**: System MUST present a grid UI with days of week (Sun-Sat) as columns and week occurrences (1st-5th) as rows
- **FR-004**: System MUST allow selecting a food vendor for each day/week combination per location
- **FR-005**: System MUST support inline creation of new food vendors from the grid selector
- **FR-006**: System MUST store vendor IDs in a JSON structure keyed by location ID
- **FR-007**: System MUST provide per-location exclusions for marking dates when recurring vendors won't be present
- **FR-008**: System MUST display which vendor(s) will be excluded when a date is selected in the exclusion form
- **FR-009**: System MUST provide a Food Vendors collection with name, website URL, and logo fields
- **FR-010**: System MUST allow the Food collection to reference vendors from the Food Vendors collection
- **FR-011**: System MUST calculate week occurrence (1st-5th) based on the date's position in the month
- **FR-012**: System MUST display recurring food entries on the frontend merged with individual Food documents
- **FR-013**: Individual Food documents MUST take priority over recurring entries on the same date

### Key Entities

- **FoodVendor**: Represents a food vendor business (name, website, logo). Can be assigned to recurring schedules or one-off food events.
- **RecurringFood (Global)**: Configuration storing schedules and exclusions in JSON format:
  - `schedules`: `{ [locationId]: { [day]: { [week]: vendorId } } }` - 35 vendor slots per location (7 days x 5 weeks)
  - `exclusions`: `{ [locationId]: string[] }` - Array of excluded date strings per location
- **Food**: Individual food events with date, time, location, and vendor reference. Takes priority over recurring schedule on same date.
- **Location**: Dynamic locations fetched from the Locations collection - tabs are generated automatically based on active locations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Managers can schedule all 35 weekly slots (7 days x 5 weeks) for a location in under 10 minutes
- **SC-002**: Creating a new vendor inline takes under 30 seconds without leaving the scheduling page
- **SC-003**: 100% of recurring schedule data persists correctly after save/reload
- **SC-004**: Exclusion preview shows correct vendor information within 2 seconds of date selection
- **SC-005**: Grid interface displays all 7 days visible without horizontal scrolling on standard desktop screens (1920px+)

## Implementation Notes

### Files Created/Modified

**Admin/Backend:**
- `/src/globals/RecurringFood.ts` - Global with JSON fields (`schedules`, `exclusions`) and UI component
- `/src/collections/FoodVendors.ts` - Collection for vendor management
- `/src/collections/Food.ts` - Updated to use vendor relationship
- `/src/components/RecurringFoodGrid.tsx` - Dynamic grid UI that fetches locations from API
- `/src/components/FoodDateWarning.tsx` - Shows recurring food conflicts when editing Food docs
- `/src/components/EventDateWarning.tsx` - Shows recurring food conflicts when editing Events
- `/src/access/roles.ts` - Role-based access helpers (`hasRole`, `adminAccess`, `foodManagerAccess`)

**Frontend:**
- `/lib/utils/payload-api.ts` - Added `getUpcomingRecurringFood()`, `getCombinedUpcomingFood()` functions
- `/lib/utils/homepage-data.ts` - Updated to merge recurring food with individual Food docs
- `/src/app/(frontend)/food/page.tsx` - Client-side fetching and merging of recurring food

### Technical Decisions Made

1. **Location-agnostic architecture**: Locations are stored by ID, not hardcoded slugs. Tabs generated dynamically from `/api/locations?where[active][equals]=true`
2. **JSON storage**: Using Payload `json` field type for flexible key-value storage instead of hardcoded relationship fields
3. **Data structure**: `schedules[locationId][day][week] = vendorId` where day is `sunday`-`saturday` and week is `first`-`fifth`
4. **Exclusions per-location**: Each location has its own array of excluded date strings
5. **Frontend merging**: Recurring entries expanded into dated entries, merged with individual Food docs, deduplicated by date (individual takes priority)
6. **Week occurrence formula**: `Math.ceil(dayOfMonth / 7)` for calculating 1st-5th occurrence
7. **Vendor ID storage**: Store vendor IDs (not full objects) in JSON, fetch vendor details separately when needed

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    RecurringFood Global                      │
├─────────────────────────────────────────────────────────────┤
│ schedules: {                                                 │
│   "loc_abc123": {                                           │
│     "sunday": { "first": "vendor_1", "second": null },      │
│     "monday": { "first": "vendor_2", ... },                 │
│     ...                                                      │
│   },                                                         │
│   "loc_def456": { ... }                                     │
│ }                                                            │
├─────────────────────────────────────────────────────────────┤
│ exclusions: {                                                │
│   "loc_abc123": ["2026-12-25", "2026-01-01"],              │
│   "loc_def456": ["2026-12-25"]                              │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               Frontend Data Flow                             │
├─────────────────────────────────────────────────────────────┤
│ 1. Fetch individual Food docs (date >= today)               │
│ 2. Fetch RecurringFood global                               │
│ 3. Expand recurring schedules into dated entries            │
│ 4. Filter out excluded dates                                │
│ 5. Filter out dates with individual Food docs               │
│ 6. Merge and sort by date                                   │
└─────────────────────────────────────────────────────────────┘
```
