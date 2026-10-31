# Admin dashboard: Needs attention, Inbox, compact menu targets, role layouts

Branch `feat/admin-dashboard`, stacked on `chore/payload-4-beta6` (PR #344; rebase onto `main` once it merges).
Mockups: https://claude.ai/artifact/1RsCctZrsDTyqVgjoKeUHy (A: admin dashboard, B: bartender on a phone).

## Goal

Keep the mockup's interfaces, built the Payload way:

- Widgets render Payload's own card markup (`card widget-card`, `widget-card__header/__title/__rows/__row/__row-link/__row-main/__row-title/__row-meta/__type/__empty`) and `Pill` / `Button` from `@payloadcms/ui`. No look-alike components, no hard-coded colors: theme tokens only (`--color-*`, `--spacer-*`, `--text-*`).
- Every read and write runs as the signed-in user (`overrideAccess: false` plus `req` on the server, cookie-authenticated REST on the client), so access rules decide what each role sees. A collection the viewer cannot read simply contributes no rows.
- Reuse what exists: `readMenuTargets` (MenuTargetHistory), the lines-cleaned cadence (`lib/utils/lines-cleaned.ts`), the PATCH in `MarkLinesCleanedButton`, the mailto guard in `lib/donate/reply-mailto.ts`, the schedule loader in `ScheduleHeatmap`.
- Clean up the existing widgets while touching them: move inline styles into one stylesheet on theme tokens, replace hand-rolled pills/buttons with Payload's.

## Building blocks (checked against `@payloadcms/ui` 4.0.0-beta.6)

`@payloadcms/ui` exports `./elements/*`, `./hooks/*`, `./icons/*` and `./utilities/*` besides its main entry, so every element below is importable. Its `WidgetCard` / `WidgetList` are internal (not exported since beta.4), so widgets write Payload's `widget-card__*` markup themselves, as the existing widgets already do.

| Need                                                                  | Use                                                                                                                                                                                        |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Widget frame, header, rows, type label, empty state                   | Payload's `card widget-card` / `widget-card__*` classes                                                                                                                                    |
| Status labels ("3 new", "8 over", "Due tomorrow")                     | `Pill` (`warning` / `error` / `success`)                                                                                                                                                   |
| Actions (Mark cleaned, Mark contacted, Approve)                       | `Button` (`secondary`, `ghost`)                                                                                                                                                            |
| Inbox filters, bartender location switch                              | `Tabs` (text tabs, keyboard support)                                                                                                                                                       |
| Open an inquiry, request or application without leaving the dashboard | `useDocumentDrawer` (Payload's document drawer)                                                                                                                                            |
| "Saved" / error feedback after an action                              | `toast`                                                                                                                                                                                    |
| Relative times ("4d ago")                                             | `formatRelativeDate` + `getRelativeTimeFormat` from `@payloadcms/ui/utilities/formatRelativeDate` (Payload: "shared by dashboard widgets so their relative timestamps render identically") |
| Hover detail on heatmap days and sparklines                           | `Tooltip`                                                                                                                                                                                  |
| Loading rows in client widgets                                        | `ShimmerEffect` / `StaggeredShimmers`                                                                                                                                                      |
| Icons                                                                 | `@payloadcms/ui/icons/*` (`Calendar`, `Clock`, `Warning`, `Check`, `People`)                                                                                                               |
| Recents & pinned                                                      | built-in `activity` widget                                                                                                                                                                 |
| "Edited by" names                                                     | repo `src/components/admin/editor-names.ts`                                                                                                                                                |

Hand-built, because Payload has no equivalent: the sparkline (inline SVG, as `MenuTargetHistory` already draws), the existing heatmap grid, and one layout-only stylesheet on theme tokens.

## Out of scope

- Sending email from "Mark contacted" / "Approve" (status change only; Email opens the staff member's mail app as today).
- A count/stat widget type. Counts live inside Needs attention rows.
- Changing anyone's saved dashboard. `defaultLayout` only reaches users without a saved layout or who reset theirs (called out in the PR).

## Tasks

Each task starts by writing its named test and running it red. UI rendering is excepted from TDD: test the data/logic, verify the render visually (task 17).

### 1. Shared widget stylesheet

- Create `src/components/admin/dashboard-widgets.scss` (module comment). Classes extend Payload's card: `lolev-widget__toolbar`, `__tabs`, `__actions`, `__spark`, `__stat`. Theme tokens only.
- Types: none.
- Test: none (styles; verified in task 17).
- Accept: `pnpm lint` clean; file imported by tasks 7, 9, 10, 12.
- Deps: none. **Parallel.**

### 2. Generic reply mailto

- Create `lib/email/reply-mailto.ts`: `replyMailto({ to, subject, body }): string | null`, moving the cc/bcc injection guard out of `lib/donate/reply-mailto.ts`; `donationReplyMailto` becomes a thin caller. Add `inquiryReplyMailto(inquiry)` and `jobReplyMailto(application)` beside their summaries.
- Types: `EventInquiry`, `JobApplication`, `DonationRequest` (payload-types).
- Test first: `tests/int/reply-mailto.int.spec.ts` (guard rejects `%0Acc:` style addresses; subject/body encode; inquiry and job summaries). Existing `tests/int/donation-reply-mailto.int.spec.ts` must stay green.
- Accept: `vitest run tests/int/reply-mailto.int.spec.ts tests/int/donation-reply-mailto.int.spec.ts`, `tsc --noEmit`.
- Deps: none. **Parallel.**

### 3. Job application status field + migration

- `src/collections/JobApplications.ts`: add `status` select (`new` default, `reviewed`), sidebar, label "Review status", added to `defaultColumns`.
- Migration `src/migrations/20261031_160000_job_application_status.ts`, registered in `src/migrations/index.ts`:
  ```ts
  export async function up({ payload }: MigrateUpArgs): Promise<void> {
    await payload.db.collections['job-applications'].collection.updateMany(
      { status: { $exists: false } },
      { $set: { status: 'reviewed' } },
    )
  }
  export async function down(_args: MigrateDownArgs): Promise<void> {
    // Leave the field; an older build ignores it.
  }
  ```
  Existing applications start as `reviewed` (decided 2026-10-31), so only new submissions show as waiting.
- Run `pnpm generate:types`.
- Types: `JobApplication['status']`.
- Test first: extend `tests/int/job-application.int.spec.ts` (default is `new`; only admins update it).
- Accept: test green, `tsc --noEmit`. Migration runs only on the prod build (local dev shares the prod DB, so un-migrated docs read `status: undefined` there; widgets query `status: new` only, so a missing status counts as handled).
- Deps: none. **Parallel.**

### 4. Extract the menu-target loader

- Move `readMenuTargets` and its types out of `src/components/admin/MenuTargetHistory.tsx` into `lib/admin/menu-targets.ts`; add a pure `summarizeMenuTarget(timeline, target)` returning `{ count, target, diff, state: 'on' | 'under' | 'over', shareOnTarget, series }`.
- Types: `MenuTargetSummary`.
- Test first: `tests/int/menu-target-summary.int.spec.ts`; existing `tests/int/menu-target.int.spec.ts` stays green.
- Accept: both green, `tsc --noEmit`, MenuTargetHistory output unchanged.
- Deps: none. **Parallel.**

### 5. Extract "mark lines cleaned"

- Move the PATCH from `MarkLinesCleanedButton.tsx` into `lib/admin/mark-lines-cleaned.ts`: `markLinesCleaned(locationId): Promise<string>` (returns the saved ISO date, throws on non-2xx). The field button calls it.
- Types: none new.
- Test first: extend `tests/int/mark-lines-cleaned.int.spec.tsx` with the helper (PATCH body, error path).
- Accept: green, `tsc --noEmit`.
- Deps: none. **Parallel.**

### 6. Needs-attention rows (pure)

- Create `lib/admin/needs-attention.ts`: `buildAttentionRows({ newInquiries, newDonations, newApplications, locations, menuTargets, now, locationId? })` → `AttentionRow[]` (`{ key, pillStyle: 'warning' | 'error', pill, title, meta, href, action?: { kind: 'mark-cleaned', locationId } }`), ordered: overdue lines, then new submissions oldest-first, then menus off target by more than 2.
- Test first: `tests/int/needs-attention.int.spec.ts` (empty input → `[]`; due/overdue via `LINES_WARN_DAYS`/`LINES_OVERDUE_DAYS`; pluralization; `locationId` filters to one location).
- Accept: green, `tsc --noEmit`.
- Deps: 3, 4.

### 7. Needs attention widget

- Create `src/components/admin/NeedsAttentionWidget.tsx` (server): counts `status: new` in event-inquiries, donation-requests, job-applications with `overrideAccess: false, req` (a denied read yields no row), reads locations and `readMenuTargets`, renders Payload card rows with `Pill`. Optional widget field `location` (relationship) for per-location instances.
- Create `src/components/admin/MarkCleanedRowButton.tsx` (client): `Button buttonStyle="secondary"` calling task 5's helper, then `toast.success` and `router.refresh()` (`toast.error` on failure); shown only when the viewer may update that location (`hasRole` admin / assigned lead-bartender, mirroring `LinesCleanedAlert`).
- Remove the `LinesCleanedAlert` provider from `src/payload.config.ts` and delete `src/components/admin/LinesCleanedAlert.tsx`; the widget's lines rows replace it (same audience: admins all locations, lead bartenders assigned ones; due/overdue from `lib/utils/lines-cleaned.ts`).
- Empty state: `widget-card__empty` "Nothing needs attention."
- Types: `NeedsAttentionWidget` (generated widget data).
- Test first: `tests/int/needs-attention-widget.int.spec.tsx` (queries run as the user; a rejected read drops its row; button only for permitted roles).
- Accept: green, `tsc --noEmit`.
- Deps: 1, 5, 6.

### 8. Inbox rows (pure)

- Create `lib/admin/inbox.ts`: `buildInboxRows({ inquiries, donations, applications })` → `InboxRow[]` (`{ id, collection, kind: 'Event' | 'Donation' | 'Job', title, detail, createdAt, href, mailto, handledStatus }`), oldest waiting first. `handledStatus`: `contacted` / `approved` / `reviewed`.
- Test first: `tests/int/inbox.int.spec.ts`.
- Accept: green, `tsc --noEmit`.
- Deps: 2, 3.

### 9. Inbox widget (replaces Donation requests widget)

- Create `src/components/admin/InboxWidget.tsx` (server, reads the three collections as the user, `status: new`) and `InboxRows.tsx` (client: kind filter as Payload `Tabs` with counts in the labels, `widget-card__type` labels, row title opens the document in Payload's drawer via `useDocumentDrawer` (saving there refreshes the widget), relative time via `formatRelativeDate`, Email link, ghost `Button` that PATCHes `/api/<collection>/<id>` `{ status: handledStatus }` then `toast` + `router.refresh()`).
- Delete `src/components/admin/DonationRequestsWidget.tsx` and `tests/int/donation-requests-widget.int.spec.tsx`; keep the `donation-requests` slug registered, rendering InboxWidget filtered to donations, so saved layouts keep working.
- Types: `InboxRow`, `InboxWidget`.
- Test first: `tests/int/inbox-widget.int.spec.tsx` (reads as the user; denied collection omitted; PATCH body per collection; donation slug still renders).
- Accept: green, `tsc --noEmit`.
- Deps: 1, 8.

### 10. Compact menu targets

- `src/components/admin/MenuTargetHistory.tsx`: default view becomes one card per menu (count of target, `Pill` state, inline-SVG sparkline from `series`, share on target), worst first. Widget field `view: 'cards' | 'chart'` (default `cards`) keeps the existing chart available. Inline styles move to task 1's stylesheet.
- Test first: `tests/int/menu-target-cards.int.spec.tsx` (ordering, pill state, `view: 'chart'` still renders the chart).
- Accept: green, `tsc --noEmit`.
- Deps: 1, 4.

### 11. Schedule heatmap cleanup

- `ScheduleHeatmap.scss`: "nothing booked" becomes a neutral token (`--color-bg-secondary`) instead of danger red; legend text "Nothing booked" kept.
- `ScheduleHeatmap.tsx` / `HeatmapGrid.tsx`: add a "Tonight:" line from today's bookings; day hover uses Payload `Tooltip` instead of the native `title`; dashboard window `WEEKS` 70 → 26 (`lib/utils/schedule-heatmap.ts`), paging unchanged.
- Test first: extend `tests/int/schedule-heatmap.int.spec.ts` (tonight summary text; window length).
- Accept: green, `tsc --noEmit`.
- Deps: 1.

### 12. Menu items widget cleanup

- `src/components/admin/MenuItems.tsx`: inline styles to task 1's stylesheet; rows use `widget-card__row` markup; "Edit menu" link unchanged.
- Test first: `tests/int/menu-items-widget.int.spec.tsx` (reads as the user; item kind filter).
- Accept: green, `tsc --noEmit`.
- Deps: 1. **Parallel with 10, 11.**

### 13. Role-based default layout

- Create `src/admin/dashboard-layout.ts`: `defaultDashboardLayout({ user, locations, menus })` → widget instances.
  - admin / event-manager: needs-attention (full), inbox (large), activity (small), menu-target-history (full), schedule-heatmap per location (medium).
  - bartender / lead-bartender: per assigned location, needs-attention (`location` set), menu-items for that location's menus, schedule-heatmap. This is mockup B. A bartender with several locations switches between them with Payload `Tabs` inside the needs-attention widget (no `location` set means "my assigned locations"); a pinned `location` shows just that one.
  - `collections` and the four admin `menu-items` widgets leave the admin default (still in the picker).
- `src/payload.config.ts`: `defaultLayout` calls it (reads locations and menus as the user).
- Test first: `tests/int/dashboard-layout.int.spec.ts` (per role; bartender sees only assigned locations).
- Accept: green, `tsc --noEmit`.
- Deps: 7, 9, 10.

### 14. Register widgets

- `src/payload.config.ts`: add `needs-attention` and `inbox` widgets (labels, `minWidth`, fields), `view` field on `menu-target-history`; run `pnpm generate:importmap` and `pnpm generate:types`.
- Test: covered by 7, 9, 10, 13; add an assertion in `tests/int/dashboard-layout.int.spec.ts` that every slug the layout uses is registered.
- Accept: `tsc --noEmit`, `pnpm lint`.
- Deps: 7, 9, 10, 13.

### 15. Documentation

- Module comments on every new file; update stale comments in touched widgets.
- `README.md` admin section and `AGENTS.md` access notes: dashboard widgets, role layouts, job application status.
- Accept: reviewed in the PR diff.
- Deps: 14.

### 16. Full validation

- `tsc --noEmit`, `pnpm lint`, `vitest run`, `pnpm build`.
- Deps: 15.

### 17. Visual check (preview)

- Desktop 1440px as admin, phone 390px as a bartender: every widget renders with Payload styling in light and dark theme; Mark cleaned, Mark contacted, Approve and Mark reviewed update state; denied roles see no rows they cannot read.
- Deps: 16.

## Parallelism

- Wave 1 (parallel): 1, 2, 3, 4, 5
- Wave 2: 6 (after 3, 4), 8 (after 2, 3), 11 and 12 (after 1)
- Wave 3: 7 (after 1, 5, 6), 9 (after 1, 8), 10 (after 1, 4)
- Wave 4 (sequential): 13, 14, 15, 16, 17

## Decisions (2026-10-31)

1. Mark contacted / Approve / Mark reviewed change status only; no email is sent.
2. Existing job applications migrate to `reviewed`.
3. Bartender location switching uses Payload `Tabs` inside the needs-attention widget.
4. The global lines-cleaned banner (`LinesCleanedAlert`, an admin provider) is retired; its job moves into the needs-attention widget (task 7), which keeps its role rule: admins see every location, lead bartenders their assigned ones.

## Deviations during implementation

- Task 1's stylesheet was created by its first consumer (task 12); each new widget also has its own SCSS next to it (`NeedsAttentionWidget.scss`, `InboxWidget.scss`, `MenuTargetHistory.scss`), following `ScheduleHeatmap.scss`. Vitest skips PostCSS so components importing SCSS load in tests.
- `summarizeMenuTarget(timeline)` takes no target argument (each save carries its target) and returns `null` for a menu with no saves.
- Heatmap: neutral cells use `--color-bg-tertiary` (secondary was invisible on faded past days); with 26-week pages, `PAGES_BACK` 3 → 8 keeps ~4 years of history and `PAGES_AHEAD` 1 → 2 reaches ~18 months ahead. Lines-cleaned due dates are computed in America/New_York.
- Donation inbox rows say "Taproom night" instead of the raw location slug the form stores.
- Payload beta.6 has no `widget-card__type` style; `InboxWidget.scss` styles the type label.
- The location switch for bartenders is Payload `Tabs` inside Needs attention (decision 3); there is no per-location widget group.
