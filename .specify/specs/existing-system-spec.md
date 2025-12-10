# System Specification: LOLEV Beer Website

**Created**: 2025-12-06
**Updated**: 2025-12-07
**Status**: Current State Documentation
**Purpose**: Complete specification of existing functionality

---

## Overview

LOLEV Beer is a multi-location craft brewery website built on Next.js 15 + Payload CMS 3. The system manages beer menus, events, food vendor schedules, and location-specific information for multiple brewery taprooms.

**Locations**:
- **Lawrenceville** - Flagship production facility and taproom
- **Zelienople** - Secondary taproom location

---

## User Scenarios & Journeys

### User Story 1 - Browse Current Beer Menu (Priority: P1)

A visitor wants to see what beers are currently available at a specific location.

**Why this priority**: Core value proposition - visitors need to know what's on tap before visiting.

**Independent Test**: Navigate to /beer, select location, view filtered beer list with accurate tap/can availability.

**Acceptance Scenarios**:

1. **Given** a visitor on the homepage, **When** they click "Beer" navigation, **Then** they see all available beers with filtering options
2. **Given** a visitor on the beer page, **When** they select "Lawrenceville" location filter, **Then** only beers available at Lawrenceville are shown
3. **Given** a visitor viewing beers, **When** they toggle "On Tap" filter, **Then** only draft beers are displayed
4. **Given** a visitor viewing beers, **When** they toggle "In Cans" filter, **Then** only packaged beers are displayed
5. **Given** a visitor viewing beers, **When** they use ABV slider, **Then** beers are filtered by ABV range
6. **Given** a visitor viewing beers, **When** they search by name, **Then** matching beers are displayed

---

### User Story 2 - Check Location Hours & Status (Priority: P1)

A visitor wants to know if a location is currently open and when they can visit.

**Why this priority**: Essential information for planning visits.

**Independent Test**: View any page, see location selector with open/closed status and hours.

**Acceptance Scenarios**:

1. **Given** a visitor on any page, **When** they view the location selector, **Then** they see current open/closed status for selected location
2. **Given** a location is open, **When** visitor views hours, **Then** today's hours are prominently displayed
3. **Given** a location is closed, **When** visitor views hours, **Then** next opening time is shown
4. **Given** a holiday with special hours, **When** visitor views hours, **Then** holiday hours override regular hours
5. **Given** a visitor, **When** they switch locations, **Then** hours update to reflect selected location's schedule

---

### User Story 3 - View Upcoming Events (Priority: P2)

A visitor wants to see upcoming events (live music, trivia, etc.) at the brewery.

**Why this priority**: Drives foot traffic and repeat visits.

**Independent Test**: Navigate to /events, see chronological list of upcoming events with location filtering.

**Acceptance Scenarios**:

1. **Given** a visitor on events page, **When** page loads, **Then** upcoming events are displayed chronologically
2. **Given** events exist at both locations, **When** visitor selects "All" filter, **Then** events from both locations are shown
3. **Given** events exist, **When** visitor selects specific location, **Then** only that location's events appear
4. **Given** an event has a website link, **When** visitor clicks event, **Then** external site opens in new tab
5. **Given** visitor on homepage, **When** they view "Upcoming Events" section, **Then** they see next few events with link to full calendar

---

### User Story 4 - View Food Truck Schedule (Priority: P2)

A visitor wants to know which food vendors will be at the brewery and when.

**Why this priority**: Food availability influences visit decisions.

**Independent Test**: Navigate to /food, see upcoming food vendor schedule by location.

**Acceptance Scenarios**:

1. **Given** a visitor on food page, **When** page loads, **Then** upcoming food vendors are displayed by date
2. **Given** food scheduled at both locations, **When** visitor selects location filter, **Then** only that location's food schedule appears
3. **Given** a food vendor has a website, **When** visitor clicks vendor, **Then** external site opens in new tab
4. **Given** visitor on homepage, **When** they view "Upcoming Food" section, **Then** they see next scheduled food vendors

---

### User Story 5 - View Individual Beer Details (Priority: P2)

A visitor wants to learn more about a specific beer including description, ABV, style, and availability.

**Why this priority**: Supports informed purchasing decisions.

**Independent Test**: Click any beer card, navigate to detail page with full information.

**Acceptance Scenarios**:

1. **Given** a visitor on beer page, **When** they click a beer card, **Then** they navigate to beer detail page
2. **Given** a visitor on beer detail, **When** page loads, **Then** they see name, style, ABV, description, and image
3. **Given** a beer has an Untappd link, **When** visitor clicks Untappd button, **Then** Untappd page opens
4. **Given** a beer is available in cans, **When** visitor views detail, **Then** four-pack pricing is displayed
5. **Given** a beer is on draft, **When** visitor views detail, **Then** draft pricing is displayed

---

### User Story 6 - Switch Between Locations (Priority: P2)

A visitor wants to easily switch between viewing information for different brewery locations.

**Why this priority**: Enables seamless multi-location experience.

**Independent Test**: Use location selector, verify all page content updates to reflect selected location.

**Acceptance Scenarios**:

1. **Given** a visitor on any page, **When** they click location selector, **Then** they see all available locations
2. **Given** a visitor selects new location, **When** selection is made, **Then** page content updates to reflect that location
3. **Given** a visitor selects location, **When** they navigate to other pages, **Then** location preference persists
4. **Given** a visitor returns to site later, **When** page loads, **Then** their previous location preference is remembered (localStorage)
5. **Given** a URL with location parameter, **When** visitor loads page, **Then** URL location overrides stored preference

---

### User Story 7 - View Full-Screen Menu Display (Priority: P3)

Staff want to display beer menus on TVs/screens at the brewery.

**Why this priority**: Operational tool for in-venue display.

**Independent Test**: Navigate to /m/[menuUrl], see full-screen optimized menu display.

**Acceptance Scenarios**:

1. **Given** a valid menu URL, **When** /m/[url] is accessed, **Then** full-screen menu is displayed
2. **Given** a draft menu, **When** displayed, **Then** tap list with prices is shown
3. **Given** a cans menu, **When** displayed, **Then** packaged beer list with four-pack prices is shown
4. **Given** menu items change in CMS, **When** display refreshes, **Then** updated menu is shown

---

### User Story 8 - Admin: Manage Beer Catalog (Priority: P1)

Admin staff need to add, edit, and manage the beer catalog.

**Why this priority**: Core content management capability.

**Independent Test**: Log into /admin, create/edit/delete beers with all fields.

**Acceptance Scenarios**:

1. **Given** an admin user, **When** they access /admin, **Then** they can log in and see dashboard
2. **Given** logged-in admin, **When** they create new beer, **Then** slug is auto-generated from name
3. **Given** logged-in admin, **When** they create beer without recipe number, **Then** next sequential number is assigned
4. **Given** logged-in admin, **When** they set four-pack price, **Then** single can price is auto-calculated
5. **Given** logged-in admin, **When** they upload beer image, **Then** image is stored in Vercel Blob
6. **Given** logged-in admin, **When** they mark beer as "hidden", **Then** beer doesn't appear on public site

---

### User Story 9 - Admin: Manage Menus (Priority: P1)

Admin staff need to create and update draft/cans menus for each location.

**Why this priority**: Core content management for daily operations.

**Independent Test**: Create/edit menus in admin, verify changes appear on public site.

**Acceptance Scenarios**:

1. **Given** logged-in admin, **When** they create new menu, **Then** they can select type (draft/cans) and location
2. **Given** menu created, **When** admin adds beer items, **Then** beers can be selected from catalog with prices
3. **Given** cans menu, **When** saved, **Then** items are auto-sorted by recipe number (newest first)
4. **Given** menu updated, **When** public site loads, **Then** new menu content is displayed
5. **Given** menu URL, **When** admin saves menu, **Then** URL is auto-generated from location and type

---

### User Story 10 - Admin: Sync from Google Sheets (Priority: P2)

Admin staff need to sync event/food/beer data from Google Sheets.

**Why this priority**: Enables non-technical staff to update data via familiar tools.

**Independent Test**: Access /admin/sync, trigger sync, verify data updates in CMS.

**Acceptance Scenarios**:

1. **Given** logged-in admin, **When** they access sync page, **Then** they see sync interface with options
2. **Given** admin triggers sync, **When** sync runs, **Then** real-time progress is streamed via SSE
3. **Given** Google Sheet has new events, **When** synced, **Then** new events appear in Events collection
4. **Given** Google Sheet has updated beer data, **When** synced, **Then** beer records are updated
5. **Given** sync encounters errors, **When** error occurs, **Then** error is displayed and partial sync continues

---

### User Story 11 - Admin: Manage Events (Priority: P2)

Admin staff need to create and manage brewery events.

**Why this priority**: Event management drives customer engagement.

**Independent Test**: Create/edit events in admin, verify appearance on public events page.

**Acceptance Scenarios**:

1. **Given** logged-in admin, **When** they create event, **Then** they can set vendor, date, time, location
2. **Given** event created, **When** public events page loads, **Then** new event appears in list
3. **Given** event with site URL, **When** saved, **Then** URL is clickable on public site
4. **Given** event marked private, **When** public site loads, **Then** event is not displayed

---

### User Story 12 - Admin: Manage Food Schedule (Priority: P2)

Admin staff need to manage food vendor schedules.

**Why this priority**: Food scheduling is operational necessity.

**Independent Test**: Create/edit food entries in admin, verify appearance on food page.

**Acceptance Scenarios**:

1. **Given** logged-in admin, **When** they create food entry, **Then** they can set vendor, date, time, location
2. **Given** food entry created, **When** public food page loads, **Then** vendor appears in schedule
3. **Given** food vendor has website, **When** saved with URL, **Then** URL is clickable on public site

---

### User Story 13 - Admin: Manage Locations (Priority: P3)

Admin staff need to manage brewery locations and their hours.

**Why this priority**: Foundation for multi-location system.

**Independent Test**: Edit location in admin, verify hours and info update on public site.

**Acceptance Scenarios**:

1. **Given** logged-in admin, **When** they edit location, **Then** they can update name, address, phone, email
2. **Given** logged-in admin, **When** they edit hours, **Then** they can set open/close for each day of week
3. **Given** hours updated, **When** public site loads, **Then** new hours are displayed
4. **Given** holiday hours needed, **When** admin creates holiday entry, **Then** holiday hours override regular hours on that date
5. **Given** logged-in admin, **When** they upload location images, **Then** card and hero images are stored in CMS
6. **Given** logged-in admin, **When** they set Hours Google Sheet URL, **Then** hours can be synced from that sheet

---

### User Story 16 - Admin: Sync Hours from Google Sheets (Priority: P2)

Admin staff need to sync location hours from Google Sheets for easy bulk updates.

**Why this priority**: Enables non-technical staff to update hours via familiar spreadsheet tools.

**Independent Test**: Configure hours sheet URL on location, run sync, verify hours updated.

**Acceptance Scenarios**:

1. **Given** location has hoursSheetUrl configured, **When** admin runs hours sync, **Then** hours are fetched from Google Sheet
2. **Given** hours sheet has "name,hours" format, **When** synced, **Then** times like "4pm - 10pm" are parsed correctly
3. **Given** hours sheet has "noon" or "midnight", **When** synced, **Then** special times are parsed correctly
4. **Given** location has timezone set, **When** hours synced, **Then** times are stored respecting that timezone
5. **Given** no hoursSheetUrl configured, **When** sync runs, **Then** location is skipped with message
6. **Given** hours unchanged, **When** sync runs, **Then** location shows "unchanged" status

---

### User Story 17 - Admin: Per-Document Sheet URLs (Priority: P3)

Each CMS document can reference its own Google Sheet for syncing.

**Why this priority**: Enables explicit, auditable data source tracking per document.

**Independent Test**: Set sheetUrl on menu document, run sync, verify that URL is used.

**Acceptance Scenarios**:

1. **Given** menu has sheetUrl configured, **When** menu sync runs, **Then** that URL is used instead of environment variable
2. **Given** location has hoursSheetUrl configured, **When** hours sync runs, **Then** that URL is used
3. **Given** no document-level URL configured, **When** sync runs, **Then** falls back to environment variable
4. **Given** sync in progress, **When** viewing logs, **Then** shows "(from document)" or "(from env)" indicator

---

### User Story 14 - View About/FAQ Information (Priority: P3)

A visitor wants to learn about the brewery philosophy, locations, and common questions.

**Why this priority**: Supports brand engagement and customer education.

**Independent Test**: Navigate to /about and /faq, view static content pages.

**Acceptance Scenarios**:

1. **Given** visitor navigates to /about, **When** page loads, **Then** brewery philosophy and location cards are displayed
2. **Given** visitor navigates to /faq, **When** page loads, **Then** FAQ accordion is displayed
3. **Given** visitor on about page, **When** they view location cards, **Then** each location shows address and map

---

### User Story 15 - SEO & Discoverability (Priority: P3)

Search engines need structured data to properly index the brewery.

**Why this priority**: Drives organic traffic and local search visibility.

**Independent Test**: View page source, verify JSON-LD schemas and meta tags.

**Acceptance Scenarios**:

1. **Given** any page, **When** search engine crawls, **Then** LocalBusiness JSON-LD schema is present
2. **Given** beer detail page, **When** crawled, **Then** Product JSON-LD schema is present
3. **Given** events page, **When** crawled, **Then** Event JSON-LD schemas are present for each event
4. **Given** any page, **When** viewed, **Then** proper OpenGraph and Twitter card meta tags exist
5. **Given** sitemap requested, **When** /sitemap.xml accessed, **Then** dynamic sitemap is returned

---

## Edge Cases

- **Location unavailable**: If Payload returns no locations, fallback to static defaults
- **Empty menus**: Display "No beers currently available" message
- **No upcoming events**: Display "No upcoming events" with appropriate messaging
- **Image loading failure**: Display placeholder beer image
- **Google Sheets sync failure**: Display error, allow retry, don't corrupt existing data
- **Invalid menu URL**: Return 404 for /m/[invalidUrl]
- **Timezone edge cases**: Hours calculated using location-specific timezone (America/New_York)
- **Holiday hours conflict**: Holiday hours take precedence over regular hours
- **Concurrent admin edits**: Payload handles via document locking/versioning

---

## Requirements

### Functional Requirements

**Public Site:**
- **FR-001**: System MUST display beer catalog with filtering by location, type, ABV, and availability
- **FR-002**: System MUST show location-specific hours with open/closed status
- **FR-003**: System MUST display upcoming events chronologically with location filtering
- **FR-004**: System MUST display food vendor schedule with location filtering
- **FR-005**: System MUST persist user location preference in localStorage
- **FR-006**: System MUST support URL-based location selection via query parameter
- **FR-007**: System MUST render full-screen menu displays at /m/[url] routes
- **FR-008**: System MUST provide beer detail pages at /beer/[variant] routes
- **FR-009**: System MUST generate JSON-LD structured data for SEO
- **FR-010**: System MUST provide dynamic sitemap.xml

**Admin/CMS:**
- **FR-011**: System MUST authenticate admin users before allowing CMS access
- **FR-012**: System MUST auto-generate beer slugs from names
- **FR-013**: System MUST auto-increment recipe numbers for new beers
- **FR-014**: System MUST auto-calculate single can price from four-pack price
- **FR-015**: System MUST auto-sort cans menus by recipe number (descending)
- **FR-016**: System MUST support image uploads to Vercel Blob storage
- **FR-017**: System MUST sync data from Google Sheets with real-time progress
- **FR-018**: System MUST support draft versioning for beers and menus
- **FR-019**: System MUST allow marking beers as hidden from public site
- **FR-020**: System MUST support holiday hours overrides per location
- **FR-021**: System MUST support per-document Google Sheet URLs for menus and hours
- **FR-022**: System MUST sync location hours from Google Sheets with timezone support
- **FR-023**: System MUST support CMS-managed images for locations (card/hero)
- **FR-024**: System MUST support CMS-managed hero image for homepage
- **FR-025**: System MUST parse flexible time formats (4pm, noon, midnight, 4:00 PM)

### Key Entities

- **Beer**: Name, slug, style, ABV, description, image, pricing (draft/four-pack/single), recipe number, Untappd link, availability, hidden flag
- **Location**: Name, slug, address, phone, email, timezone, weekly hours schedule, active flag, **images (card/hero)**, **hoursSheetUrl**
- **Menu**: Name, type (draft/cans), location relationship, URL, items array (beer + price), **sheetUrl**
- **Event**: Vendor/title, date, time, end time, location, site URL, description, visibility
- **Food**: Vendor, date, time, location, site URL
- **Style**: Name (beer style reference)
- **HolidayHours**: Date, location, open/close times (or closed flag)
- **User**: Email, password, **role (admin/editor)** (admin authentication)
- **SiteContent** (Global): heroDescription, **heroImage**, errorMessage, todaysEventsTitle, todaysFoodTitle

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Public pages load in under 3 seconds on mobile connections
- **SC-002**: Beer filtering responds in under 100ms (client-side)
- **SC-003**: Location switch updates all content without page reload
- **SC-004**: Google Sheets sync completes within 60 seconds for typical data volume
- **SC-005**: Admin can create new beer in under 2 minutes
- **SC-006**: Menu display pages render correctly on 1080p and 4K displays
- **SC-007**: All public pages pass Lighthouse accessibility audit (90+ score)
- **SC-008**: Site functions correctly with JavaScript disabled (SSR content visible)
- **SC-009**: Search engines can crawl and index all public beer pages

---

## Technical Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15.5.6 (App Router) |
| Runtime | React 19.2.0 |
| Language | TypeScript 5.9.3 |
| CMS | Payload CMS 3.65.0 |
| Database | MongoDB |
| Styling | Tailwind CSS 4.x |
| UI Components | Shadcn/ui (Radix primitives) |
| Maps | Mapbox GL |
| Image Storage | Vercel Blob |
| Hosting | Vercel |

### Data Flow

```
Google Sheets → Sync Endpoint → Payload CMS (MongoDB)
                                      ↓
                              payload-api.ts (cached fetchers)
                                      ↓
                              React Server Components
                                      ↓
                              Client Components (hydrated)
                                      ↓
                              Location Context (state)
```

### Key Files

| Purpose | Path |
|---------|------|
| CMS Config | `src/payload.config.ts` |
| Data Fetching | `lib/utils/payload-api.ts` |
| Homepage Data | `lib/utils/homepage-data.ts` |
| Location Context | `components/location/location-provider.tsx` |
| Google Sheets Sync | `src/endpoints/sync-google-sheets.ts` |
| Type Definitions | `lib/types/index.ts` |

---

## Collections Reference

### Beers Collection
- Auto-slug from name
- Auto-increment recipe number
- Auto-calculate single can price
- Draft versioning enabled
- Image upload to Vercel Blob

### Menus Collection
- Types: draft, cans, other
- Location relationship
- Auto-generated URL
- Auto-sorted items (cans by recipe desc)
- Draft versioning enabled
- **sheetUrl**: Per-document Google Sheet URL for syncing
- Role-based access (admin/editor)

### Locations Collection
- Address fields (street, city, state, zip)
- Contact fields (phone, email)
- Weekly hours (Mon-Sun with open/close)
- Timezone support
- Active flag
- **images.card**: Card image for location displays
- **images.hero**: Hero/banner image for location
- **hoursSheetUrl**: Google Sheet URL for syncing hours

### Events Collection
- Date/time fields
- Location relationship
- Source tracking (payload vs google-sheets)
- Public/private visibility

### Food Collection
- Date/time fields
- Location relationship
- Source tracking
- Vendor website link

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sync-google-sheets` | POST | Sync data from Google Sheets (SSE stream) |
| `/api/menu-by-url/[url]` | GET | Fetch menu by URL slug |
| `/api/[...slug]` | * | Payload REST API |
| `/api/graphql` | POST | Payload GraphQL API |

### Sync Endpoint Collections

The sync endpoint (`/api/sync-google-sheets`) supports the following collections via the `collections` query parameter:

| Collection | Source | Notes |
|------------|--------|-------|
| `events` | Environment variables | Per-location CSV URLs |
| `food` | Environment variables | Per-location CSV URLs |
| `beers` | Environment variable | Single CSV URL |
| `menus` | Document `sheetUrl` or env | Prefers per-document URL |
| `hours` | Document `hoursSheetUrl` | Per-location, timezone-aware |

**Hours CSV Format** (supported columns):
- `name` or `day`: Day name (Mon, Tuesday, etc.)
- `hours`: Combined format ("4pm - 10pm") or
- `open`/`close`: Separate columns
- Special values: "noon", "midnight", "closed"

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URI` | MongoDB connection string |
| `PAYLOAD_SECRET` | Payload encryption key |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token |
| `EVENTS_SHEET_*` | Google Sheets URLs for events |
| `FOOD_SHEET_*` | Google Sheets URLs for food |
| `BEER_SHEET_URL` | Google Sheets URL for beer data |
| `CANS_SHEET_*` | Google Sheets URLs for cans menus |
| `DRAFT_SHEET_*` | Google Sheets URLs for draft menus |
