# Feature Specification: Half Pour Pricing

**Feature Branch**: `payload`
**Created**: 2026-01-04
**Updated**: 2026-01-05
**Status**: Implemented
**Input**: Automatic half pour price calculation with manual override support

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Half Pour Prices on Menu (Priority: P1)

A visitor wants to see both half and full pour prices when viewing the beer menu.

**Why this priority**: Core menu functionality - customers need pricing information to make decisions.

**Independent Test**: View any menu page, verify both "Half" and "Full" price columns are displayed.

**Acceptance Scenarios**:

1. **Given** a visitor viewing a menu, **When** a beer has both prices, **Then** half pour and full pour prices are displayed
2. **Given** a visitor viewing a menu, **When** a beer is half-pour-only, **Then** only the half pour price is shown (full price hidden)
3. **Given** a visitor on the homepage, **When** featured menu displays, **Then** both price columns are visible

---

### User Story 2 - Auto-Calculate Half Pour Prices (Priority: P1)

As an admin, I want half pour prices to be automatically calculated from draft prices so I don't have to enter them manually.

**Why this priority**: Efficiency - reduces manual data entry and ensures consistent pricing.

**Independent Test**: Create a beer with $8 draft price, save, verify half pour is automatically set to $5.

**Acceptance Scenarios**:

1. **Given** an admin creating a beer with $8 draft price, **When** they save, **Then** half pour is auto-calculated to $5 (8/2 rounded + 1)
2. **Given** an admin editing a beer's draft price, **When** they save, **Then** half pour is recalculated
3. **Given** a beer with halfPourOnly enabled, **When** draft price changes, **Then** half pour is NOT recalculated

---

### User Story 3 - Override Half Pour Pricing (Priority: P2)

As an admin, I want to manually set half pour prices for special beers (rare, high ABV) that don't follow the standard formula.

**Why this priority**: Flexibility - some beers need custom pricing.

**Independent Test**: Create a beer, enable halfPourOnly, set custom half pour price, verify it persists after save.

**Acceptance Scenarios**:

1. **Given** an admin editing a beer, **When** they enable "Half Pour Only", **Then** the half pour field becomes manually editable
2. **Given** a beer with halfPourOnly enabled, **When** bulk recalculation runs, **Then** this beer is skipped
3. **Given** a beer with manual half pour price, **When** admin disables halfPourOnly, **Then** price is recalculated on next save

---

### Edge Cases

- What happens with very low draft prices (e.g., $2)? Formula applies: $2/2 + $1 = $2 half pour
- What happens if half pour > draft price? Unlikely with formula but allowed for manual override
- What happens during bulk recalculation with errors? Individual errors logged, process continues

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST auto-calculate half pour price using formula: `Math.round(draftPrice / 2) + 1`
- **FR-002**: System MUST allow manual override via `halfPourOnly` checkbox
- **FR-003**: System MUST skip auto-calculation for beers with `halfPourOnly` enabled
- **FR-004**: System MUST display both half and full prices in menu UI
- **FR-005**: System MUST hide full price column when `halfPourOnly` is true
- **FR-006**: System MUST provide bulk recalculation endpoint with SSE progress

### Key Entities

- **Beer.draftPrice**: Full pour price (required)
- **Beer.halfPour**: Half pour price (auto-calculated or manual)
- **Beer.halfPourOnly**: Boolean flag to enable manual pricing

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Half pour prices auto-calculated correctly for all non-override beers
- **SC-002**: Manual override prices persist through save/reload cycles
- **SC-003**: Bulk recalculation completes for 100+ beers in under 30 seconds
- **SC-004**: Menu displays correct pricing for both modes

## Implementation Summary

### Pricing Formula

```typescript
halfPour = Math.round(draftPrice / 2) + 1
```

Examples:
- $8 draft → $5 half ($8/2 = $4, +$1 = $5)
- $7 draft → $5 half ($7/2 = $3.5, rounded = $4, +$1 = $5)
- $10 draft → $6 half ($10/2 = $5, +$1 = $6)

### Files Created/Modified

| File | Purpose |
|------|---------|
| `/src/collections/Beers.ts` | beforeChange hook for auto-calculation |
| `/src/endpoints/recalculate-beer-prices.ts` | Bulk recalculation endpoint |
| `/components/home/featured-menu.tsx` | Menu display with pricing columns |
| `/components/beer/draft-beer-card.tsx` | Individual beer row with pricing |
| `/lib/types/beer.ts` | BeerPricing interface definition |

### Endpoint

`POST /api/recalculate-beer-prices`
- Query: `?dryRun=true` for preview mode
- Response: SSE stream with progress events
- Authentication: Required (admin)
