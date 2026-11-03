# Event pages: `/events/[id]`

Status: Phase 1 plan, awaiting approval. Roadmap item 6, step 2
(`docs/plans/elevate-roadmap.md`).

Worktree: `/Users/tedslesinski/Repos/site/.claude/worktrees/elevate-roadmap`.
Branch: `docs/elevate-roadmap`. Rename the branch to `feat/event-pages`, or
branch off it, before Phase 2.

## Goal

Every upcoming public event and recurring occurrence gets its own indexable,
shareable page. Event JSON-LD, the `.ics` URL, the sitemap and social cards
all point at it instead of an `/events#event-<id>` anchor.

## What exists (reused, not rebuilt)

| Need | Existing piece |
|---|---|
| Look up one public event or occurrence, anonymous, cached, private and past filtered out | `getPublicEventById` (`lib/utils/payload-api.ts:1074`). It accepts both `<objectId>` and `recurring-<id>-<YYYY-MM-DD>` ids. |
| Event JSON-LD | `generateEventJsonLd` and `eventPageUrl` (`lib/utils/json-ld.ts`) |
| Add-to-calendar | `events/[id]/calendar.ics/route.ts` and `buildEventIcs` |
| Social card | `renderOgCard` and `ogNotFound` (`lib/og/card`), `ogCardImages` (`lib/og/paths.ts`) |
| Page metadata | `buildPageMetadata` (`lib/seo/resolve-metadata`), as on `beer/[variant]/page.tsx` |
| Breadcrumb and webpage schema | `generateBreadcrumbSchema`, `generateWebPageSchema` |
| Freshness | Saves to `events` and `recurring-events` already revalidate the `events` cache tag, which `getPublicEventById` uses. No revalidation change is needed. |
| Upcoming list for the sitemap | `getAllUpcomingEventsFromPayload` (used by `/events`) |

## Database

No migration. The project uses MongoDB, and the new field is optional, so
existing documents simply lack it. Run `pnpm generate:types` after task 1.

## Tasks

### 1. Public event summary field

- Files: `src/collections/shared/event-fields.ts` and the regenerated
  `src/payload-types.ts`.
- Add `summary` (textarea, `maxLength: 300`, public read) inside the "Website
  listing" collapsible. Hide it when visibility is private, the same rule as
  `site` and `image`.
- Admin description: "Public one-to-two sentence description for the event
  page and search results." Both `events` and `recurring-events` get it,
  because both use `eventDetailFields`.
- Test first: extend `tests/int/event-fields-public-note.int.spec.ts`:
  - `summary` has no read restriction.
  - It is hidden for private events.
  - `description` stays staff-only.
- Types: `Event['summary']` and `RecurringEvent['summary']` are
  `string | null | undefined`.
- Done when: the test passes and `tsc --noEmit` is clean.
- Depends on: nothing.

### 2. Point event URLs at the new page

- Files: `lib/utils/json-ld.ts`, `lib/utils/event-ics.ts`,
  `components/ui/schedule-list.tsx` (stale comment only).
- `eventPageUrl(eventId)` returns `${LOLEV_BASE_URL}/events/${encodeURIComponent(id)}`.
  Drop the `locationSlug` and query-string arguments.
- In `generateEventJsonLd`:
  - `url` is always our page.
  - `payloadEvent.site` moves to `offers.url`.
  - `description` is `summary ?? organizer`.
- In the ICS, `URL:` becomes our page. The page carries the ticket or site
  link.
- Test first: update `tests/int/event-json-ld.int.spec.ts` and
  `tests/int/event-ics.int.spec.ts`. The URL equals `/events/<id>`, the site
  lands in `offers.url`, and the summary is used when present.
- Done when: those tests pass and `tsc` is clean.
- Depends on: 1, for the `summary` type.

### 3. Event social card

- Files: `src/app/og/event/[id]/route.tsx` (new) and `lib/og/paths.ts`, where
  the `kind` union gains `'event'`.
- Title: the event name. Subtitle: "Fri, Nov 7 · 7–10 PM · Lawrenceville
  Taproom". A miss returns `ogNotFound()`.
- Test first: add cases to `tests/int/og-card-routes.int.spec.ts` for a known
  id (200, image) and an unknown or private id (404).
- Done when: the tests pass.
- Depends on: 1.

### 4. The event page

- Files: `src/app/(frontend)/events/[id]/page.tsx` (new, with a module
  comment) and `src/app/(frontend)/events/[id]/not-found.tsx` (new, linking
  back to `/events`).
- Server component with `revalidate = 300`, calling
  `getPublicEventById(id)`. A miss (unknown, private, past or bad id) calls
  `notFound()`.
- The page renders:
  - The name, date, time, and the taproom linked to `/<location>`, with its
    address.
  - The summary and the image, falling back to no image.
  - "Tickets ↗" or "Website ↗" when `site` is set.
  - "Add to calendar" pointing at the existing `.ics` route.
  - Event, breadcrumb and webpage JSON-LD.
- `generateMetadata` uses `buildPageMetadata`, with
  `ogCardImages('event', id, ...)`. The canonical is `/events/<id>`.
- Test first: `tests/int/event-page.int.spec.ts`, following the
  `beer-page.int.spec.ts` pattern (mock the fetcher and `next/navigation`):
  - A miss calls `notFound()`.
  - A hit renders the name, taproom link and calendar link.
  - The JSON-LD `url` is the canonical.
  - A database error propagates to `error.tsx`.
- Visual check: verify the render at desktop, phone width and in dark mode
  (UI rendering is excepted from TDD).
- Done when: the test passes and `tsc` is clean.
- Depends on: 1, 2, 3.

### 5. Link listings to event pages

- Files: `components/ui/timeline-item.tsx`, `components/ui/schedule-list.tsx`,
  `src/app/(frontend)/events/events-page-client.tsx`, and the homepage events
  list.
- `TimelineItem` gets an optional `detailHref`. When it's set, the title links
  there in the same tab, and the separate "Tickets ↗" link is unchanged.
- A non-ticket `site` no longer links from the title. It appears on the
  detail page instead.
- One-offs pass `/events/<id>`. Regulars pass their next occurrence id, which
  is `occurrenceIds[0]`, the same id the calendar link already uses.
- Keep the `event-<id>` anchors for old inbound links, and update the comment
  that says JSON-LD targets them.
- Test first: `tests/int/timeline-item-detail-link.int.spec.tsx`:
  - The title links to `detailHref` when it's set.
  - A ticket site still gets its own link.
  - Without `detailHref`, today's behavior is unchanged.
- Also update `tests/int/events-page-regulars.int.spec.tsx` for the regular
  row's link.
- Done when: the tests pass and `tsc` is clean.
- Depends on: 4.

### 6. Sitemap entries

- File: `src/app/sitemap.ts`.
- Add an entry for every event `/events` lists, using
  `getAllUpcomingEventsFromPayload(100)` so the sitemap matches the page:
  - `changeFrequency: 'weekly'`, `priority: 0.6`.
  - `lastModified` from the event's `updatedAt` when present.
  - Skip everything when the events hub is set to `noIndex`.
- Test first: extend `tests/int/sitemap.int.spec.ts`:
  - One-off and recurring-occurrence URLs appear.
  - Private events never appear (the fetcher already filters them; assert
    it).
  - No event URLs appear when the hub is set to `noIndex`.
- Done when: the test passes.
- Depends on: 2. It can run in parallel with 3, 4 and 5.

### 7. Docs and final validation

- Docs:
  - `AGENTS.md` access notes: the event `summary` is public, `description`
    stays staff-only.
  - README events section, if it describes event URLs.
  - The comment at the top of `event-fields.ts`.
  - Update the item 6 status in `elevate-roadmap.md`.
- Validate: `tsc --noEmit`, then `pnpm test`, then `pnpm lint`, then
  prettier.
- On the Vercel preview, run Google's Rich Results Test on one one-off event
  page and one recurring-occurrence page.
- Depends on: all of the above.

## Parallelism

```
1 ──┬── 2 ──┬── 4 ── 5 ── 7
    │       └── 6 ────────┘
    └── 3 ──────┘
```

Tasks 2 and 3 can run in parallel after task 1. Task 6 can run in parallel
with 3, 4 and 5 once task 2 is done.

## Out of scope, with open questions

- **Ticketed events claim to be free.** Every event's JSON-LD offer is
  `price: 0` (`complimentaryOffer`), including ones with a ticket link. That's
  wrong today, but it's a separate fix. Should ticketed events drop the price,
  or should we add a price field?
- **Past events return 404.** This matches the `.ics` route. If a 410 or an
  archive matters later, `getPublicEventById` would need a past-events mode.
- **Food truck pages.** Food truck days have Event JSON-LD too
  (`generateFoodEventJsonLd`), but they don't get pages in this plan.
