# Beer Page Filters Redesign

## Problem

The current beer page has too many filters (search, style dropdown, pouring/cans toggles, ABV levels, sort) split across a sticky bar, desktop sidebar, and mobile sheet. The toggle behavior is confusing — toggling both availability switches off produces unexpected results.

## Design

Replace all filters with a single inline sticky bar containing three controls:

1. **Search** — text input with search icon
2. **Availability** — segmented pill group: `All | On Tap | In Cans`, default "All"
3. **Style pills** — scrollable pill buttons derived from available beers: `All | IPA | Lager | ...`, default "All"

## Removed

- ABV filter (Low/Med/High)
- Sort dropdown (default to recipe number, not user-configurable)
- Pouring / In Cans toggle switches
- Desktop sidebar layout (filters move to sticky bar, grid gets full width)
- Mobile filter sheet (no longer needed)

## Layout Change

Current: 1/4 sidebar + 3/4 grid on desktop.
New: Full-width grid on all screen sizes, sticky filter bar above.

## Filter Logic

- **Search**: case-insensitive match on name, description, type
- **Availability "All"**: no availability filter applied — show all beers
- **Availability "On Tap"**: only beers currently on tap at any location
- **Availability "In Cans"**: only beers with cans available
- **Style "All"**: no style filter
- **Style [specific]**: exact match on beer type
- Sort: recipe number descending (no user control)

## URL State

Preserve nuqs URL params for shareability:
- `?q=` — search
- `?avail=tap|cans` — availability (absent = all)
- `?style=IPA` — style filter (absent = all)
