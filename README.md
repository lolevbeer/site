# Lolev Beer

[![CI](https://github.com/lolevbeer/site/actions/workflows/ci.yml/badge.svg)](https://github.com/lolevbeer/site/actions/workflows/ci.yml)
[![Vercel](https://img.shields.io/github/deployments/lolevbeer/site/Production?label=vercel&logo=vercel)](https://lolev.beer)
[![health](https://img.shields.io/website?url=https%3A%2F%2Flolev.beer%2Fapi%2Fhealth&up_message=ok&down_message=unhealthy&label=health)](https://lolev.beer/api/health)

Brewery website for [lolev.beer](https://lolev.beer), built with Next.js 16 and Payload CMS 4, deployed on Vercel.

The badges above are, in order: the `CI` workflow on `main` (type-check, lint, Vitest, then a disposable production build and Playwright smoke), the latest GitHub `Production` deployment, and live `GET`/`HEAD` `https://lolev.beer/api/health`. Shields caches the health badge for a few minutes.

## Setup

Requires Node 24.15+ (Payload 4's minimum; CI reads `engines.node` from `package.json`) and pnpm 11 (`package.json` pins `packageManager` to pnpm 11).

1. Clone the repo
2. `cp .env.example .env` and fill in your values. `DATABASE_URI` and `PAYLOAD_SECRET` are required; do not leave `PAYLOAD_SECRET` as the documented placeholder. Production also requires `BLOB_READ_WRITE_TOKEN`. Slack, cron, revalidation, and geocoding keys are optional — see `.env.example`.
3. `pnpm install && pnpm dev`
4. Open `http://localhost:3000`

Payload admin is at `/admin`. Follow the on-screen instructions to create your first admin user.

### Dependency security

Security floors live in `pnpm-workspace.yaml`. Regenerate `pnpm-lock.yaml` with
the pinned pnpm version using `pnpm install --no-frozen-lockfile`; preserve the
Ably patch and `allowBuilds` policy.

The 2026-10-17 review of [#256](https://github.com/lolevbeer/site/issues/256)
confirmed the original floors are met on every locked major line:
`brace-expansion` 1.1.21 / 5.0.12, `fast-uri` 4.2.2, and `undici`
6.29.0 / 7.30.0 / 8.11.2. The follow-up updates `sharp` to 0.35.5 and
`source-map-js` to 1.2.2, with overrides preventing vulnerable resolutions.

`pnpm audit` still reports [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
for `braces` 3.0.3; no patched release is published. It appears through both
production dependencies (Payload/Sass tooling) and development tooling
(ESLint/Vite/Vitest). Dependency presence does not establish that a public
request can reach the vulnerable pattern parser; production exploitability
remains unproven. Do not suppress the advisory. Recheck for an upstream fix,
and confirm Dependabot resolution after the updated lockfile reaches GitHub
and its dependency graph refreshes.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **CMS:** Payload CMS 4 (MongoDB)
- **Styling:** Tailwind CSS 4, shadcn/ui
- **Maps:** Mapbox GL
- **Monitoring:** Sentry
- **Storage:** Vercel Blob
- **Deployment:** Vercel
- **Tests:** Vitest and Playwright

The footer offers system, light, and dark themes, persisted as `lolev-theme` in
local storage. The frontend layout's shared `ThemeProvider` must wrap both the
page content and footer; the footer stays outside `LocationProvider` so its
taproom content remains in the HTML shell.

## Scripts

```bash
pnpm dev                 # Start the development server
pnpm build               # Production build (runs pending migrations first on Vercel production)
pnpm start               # Serve a production build
pnpm type-check          # TypeScript check
pnpm lint                # ESLint
pnpm test                # Tests (Vitest)
pnpm test:e2e:install    # Install Chromium for Playwright
pnpm e2e:seed            # Seed a disposable database for the release smoke test
pnpm test:e2e            # Run Playwright against the built server on port 3100
pnpm migrate             # Run pending Payload migrations against DATABASE_URI
pnpm migrate:status      # Show which migrations have run
pnpm generate:types      # Regenerate Payload types
pnpm generate:importmap  # Regenerate Payload import map
```

`pnpm e2e:seed` writes admin and FAQ fixture data. By default it accepts only a
loopback MongoDB target. A remote target is allowed only when
`E2E_DISPOSABLE_DATABASE=1` and the database name ends in `-e2e` or `-ci`; the
seed also refuses `PAYLOAD_DROP_DATABASE=true`. Set `E2E_ADMIN_EMAIL` and
`E2E_ADMIN_PASSWORD` only for local or CI smoke tests. Never point the seed or
Playwright release smoke test at production.

## Health check

`GET /api/health` validates the server environment and pings MongoDB through
Payload. It returns HTTP 200 with generic `{"status":"ok"}` when healthy or HTTP
503 with generic `{"status":"unhealthy"}` when unavailable. `HEAD /api/health`
runs the same probe and returns the same status with an empty body so uptime
badges that send HEAD (including the Shields.io website badge on this README)
match GET. Every response sets `Cache-Control: no-store` and never exposes
dependency, failure-stage, or error details.

The health badge polls production `https://lolev.beer/api/health` and shows `ok`
for HTTP 200 or `unhealthy` for HTTP 503, timeouts, or other unsuccessful
responses. It is not a substitute for the post-deploy checks in the
[production deployment runbook](docs/operations/production-deploy.md).

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pull requests and
pushes to `main`:

1. **checks** — `pnpm type-check`, `pnpm lint`, and `pnpm test`
2. **release-smoke** — seed a disposable MongoDB, `pnpm build` with
   `VERCEL_ENV=preview` (migrations skipped), then Playwright against
   `http://127.0.0.1:3100`

[`.github/workflows/claude-code-review.yml`](.github/workflows/claude-code-review.yml)
runs Claude Code Review on pull requests. It skips bot actors (Dependabot) and
fork PRs, which can't read its token. No check is required to merge.

The CI badge reflects the latest `main` run of that workflow. Preview and
production deploys still go through Vercel auto-deploy; the Vercel badge is the
GitHub `Production` deployment status, not a preview.

## Migrations on deploy

`pnpm build` runs `migrate:prod` first, which executes pending migrations before
Vercel promotion only when `VERCEL_ENV=production`. Builds skip migrations only
when `VERCEL_ENV` is not `production`; local and CI builds must use a
non-production, disposable database context. Retry eligibility is
migration-specific. For recurring-food normalization, record the normalized
schedule and exclusion counts, confirm both are at most 10,000, and confirm
there is no unresolved duplicate-key state; otherwise use a reviewed
roll-forward. Review the migration [recovery
manifest](src/migrations/recovery/index.ts) and [production deployment
runbook](docs/operations/production-deploy.md) before recovery.

A failed build can leave partial database mutation while the previous
deployment remains live. The recovery manifest and runbook determine whether
an approved retry or targeted roll-forward is permitted. Where the manifest
requires it, an immediate compatible roll-forward or isolated Atlas restore is
mandatory. Rolling back the deployment does not reverse database mutations.
Migrations live in `src/migrations/` and are registered in
`src/migrations/index.ts`. `payload migrate` auto-discovers every `.ts`/`.js`
file in that directory except `index.ts`; keep the recovery manifest in
`src/migrations/recovery/` so it is not treated as a migration.

## Collections

- **Beers** — Beer catalog with styles, ABV, pricing, Untappd ratings, and 3D can label textures (generated in the admin from label art + metallic-mask PDFs; rendered by `components/beer/beer-can-3d.tsx`). In the Beers list, anyone who can update beers can fill an empty Tag or Untappd URL from the table with Payload's select (the Untappd one searches by the beer's name on open, or by typed text, and lists the exact name match first, marked ★); a beer with a pending draft saves the value as a draft
- **Beer Reviews** — Approved customer reviews attached to beers
- **Styles** — Beer style definitions
- **Tags** — Reusable single-value labels for beers
- **Menus** — Draft and can menus per location
- **Products** — Menu items linking beers to menus
- **Events** — Brewery events calendar
- **Recurring Events** — Date-less monthly event definitions scoped to a calendar year
- **Food** — Food truck schedule
- **Food Vendors** — Food truck vendor directory
- **Recurring Food Schedules** — Normalized monthly food-truck slots (system collection)
- **Recurring Food Exclusions** — Dates a recurring food slot does not run (system collection)
- **Locations** — Brewery locations with hours
- **Holiday Hours** — Holiday hour overrides
- **Distributors** — Distribution partners with geocoded locations, in any US state or DC or another country (`country`, ISO-2; blank = US). Bulk-add them from the admin Sync page's "Distributor CSV" upload, previewing with Dry run first; blank city/state/country are filled from Mapbox (set the server-only `MAPBOX_GEOCODING_TOKEN`), and optional `latitude`/`longitude` columns skip geocoding; the format (and instructions an agent can follow to convert raw sales data) is in [`public/distributor-csv-import.md`](public/distributor-csv-import.md)
- **FAQs** — Frequently asked questions
- **Media** — Image uploads (Vercel Blob storage)
- **Users** — Admin users with role-based access

## Public events page (`/events`)

- **Never public: an event's `description`.** The field is staff-only (field access). Public rows, JSON-LD, and `.ics` files use the event title (`organizer`).
- **Regulars.** Recurring occurrences with the same title, taproom, start time, and weekday collapse into one "Regulars" row when they repeat weekly: every gap is whole weeks and at least half are exactly one week. That tolerates a holiday skip or a 1st–4th schedule. A one-off that matches the series (an override of one week) joins it. Monthly or every-other-week series stay in the dated list.
- **Shareable links.** Each row has an `#event-<id>` anchor (`ScheduleList anchors`, plus one per collapsed occurrence under Regulars). `eventPageUrl()` builds `/events?loc=<slug>#event-<id>` for the Event JSON-LD `url`. The page scrolls to the hash once hydration applies `?loc=` and the row exists.
- **Row links.** Agenda rows (events and food, everywhere `TimelineItem` is used) are not whole-row links. An event's site shows as a "Tickets ↗" link (ticketing hosts) or a "Details ↗" link under the row. Link names include the title for screen readers.
- **Add to calendar.** `/events/<id>/calendar.ics` serves one upcoming public event as iCalendar (TZID `America/New_York`, with no `DESCRIPTION`). It reads anonymously through `getPublicEventById`, so private events and descriptions never ship. Unknown ids 404 with `no-store`. robots.txt disallows the route and the link is `nofollow`. Only `/events` passes `ScheduleList calendar`; the homepage and taproom pages link to `/events` instead.

## Admin editing

Navigation groups work into **Beer Catalog**, **Taproom Operations**, **Food &
Events**, **Hiring**, **Website**, and **Administration**. Labels such as Other
Menu Items (`products`), One-off Food Bookings (`food`), Special Hours
(`holiday-hours`), Stockists (`distributors`), Staff Accounts (`users`), and Job
Openings (`jobs`) do not rename collection slugs or API fields. Background Jobs
is the system queue, separate from hiring.

- **Fields:** Content and scheduling inputs stay in the main form. Identifiers,
  SEO, contacts and notification diagnostics use disclosures. Unnamed layout
  containers preserve stored paths, access rules, validation and save behavior.
  Existing saved list columns are not reset.
- **Beer and menus:** Beers keeps its four tabs and inline Tag/Untappd fill. Price
  labels identify serving size and dollars. Menus use required Menu name as their
  title, with Menu items first and Display settings separate. Blank item rows
  still represent empty taps; blank price overrides use catalog prices. Cans
  retain automatic newest-recipe ordering.
- **Hours:** Locations puts all seven existing weekday open/close pairs before
  images alongside timezone, separate from visitor information and website
  content. Existing field permissions remain unchanged.
- **Event privacy:** Staff notes (`description`) remain signed-in-only; Booking
  notes and contacts remain admin/event-manager-only. A dated event matching a
  series' name, location and date replaces the whole occurrence, not individual
  fields. Website listing fields are separate from staff notes.
- **Recurring food:** The grid still saves immediately and confirms skips. Rows
  mean nth weekday occurrences, not calendar weeks. Dates collapse by month;
  conflicts stay visible. A failed load shows an error rather than claiming no
  active locations. One-off bookings do not replace recurring food automatically:
  skip the recurring date explicitly.
- **Inboxes:** Changing inquiry or donation status does not send a reply or create
  a booking. On a donation request, the sidebar **Email requester** button opens
  your own email app with a summary of the request filled in. The **Donation
  requests** dashboard widget (add it from the dashboard; pick New, Approved,
  Declined, or All in its settings) lists requests with the same **Email**
  button on each row. Job Applications has no new pipeline/status field. A published job
  opening is visible immediately; its closing date alone does not hide it.

## Admin dashboard

- **Schedule heatmap** — booking status per EST day — red nothing, orange event without food, yellow food only, green both — 16 months at a time with ‹ › arrows to page back through history, filterable by location (recurring rules fill only the year they were set up for); click a day to open that day's list. Counts follow your read access. Users with a saved dashboard layout must add the widget manually.
- **Menu items** — compact, single-line beer/product rows in menu order, with ABV when available and promotions below the item. The heading and explicit **Edit menu** link open the menu editor; each item opens its record. Hover an item for its full name/style/ABV, or the location caption for the full location name. Long lists scroll inside the widget. Open **Dashboard → Edit Dashboard → Add + → Menu items**, then use the widget's edit button to choose a menu and **All menu items**, **Beers only**, or **Products only**. Add an instance for each menu you want to track; settings and widths are independent, including multiple views of the same menu. Save the widget settings, then **Save changes** on the dashboard to keep the layout. Menu and relationship reads follow the signed-in user's access; blank slots and unreadable items are omitted. No widgets are added to existing layouts automatically.

## Globals

- **Coming Soon** — Upcoming beer announcements
- **Recurring Food** — Year-by-year monthly food truck schedule
- **Site Content** — Editable site-wide content (about page, etc.)

## Email

Payload sends email through Resend (`@payloadcms/email-resend`, configured in
`src/payload.config.ts`) from `Lolev App <app@lolev.beer>`, so `lolev.beer` must stay a
verified domain in Resend. Set `RESEND_API_KEY` in Vercel; without it (local
dev, CI) Payload's console adapter logs each email instead of sending it.

- **Admin password reset** — the `/admin` "Forgot password?" form emails a
  one-time link (valid 1 hour).
- **Private-event inquiry** — `lib/events/inquiry-email.ts` emails every field
  (start time, length, other dates, drinks, company, food plan included), one
  labeled line each, to `events@lolev.beer` with the subject
  "Event inquiry: name, event type, date, taproom" and Reply-To set to the
  visitor, so the first reply can carry a quote. It also sends the visitor a
  receipt with Reply-To `events@`. The receipt repeats only validated fields (taproom, date, headcount), never the
  visitor's free text.
- **Job application** — `lib/jobs/application-email.ts` emails the application
  to `jobs@lolev.beer` with Reply-To set to the applicant.
- **Donation requests** send no email. Staff reply with the **Email requester**
  button (`lib/donate/reply-mailto.ts`), a `mailto:` link that opens their own
  email app, so the thread stays in their inbox.

Form emails are best-effort and sent in `after()` (`lib/email/send.ts`): a
failed send is logged and never blocks the form or the Slack ping.

## Slack bot

`/lolevbeer menu` in Slack lists the menus with Edit buttons; the Edit modal
swaps/adds/removes beers. Submitting shows a "Publishing…" view and does the
write in the background (Slack discards a submit response slower than 3s), then
swaps the modal to a confirmation — or an error if the menu can't be published
(not published, has unpublished admin changes, or was edited since the modal
opened). Displays update via the revalidation hooks. The beer typeahead
excludes items already on the menu being edited, except a row's own current
pick so you can revert it. Handler: `src/app/api/slack/route.ts`.

`/lolevbeer events` and `/lolevbeer food` privately list the next 14 calendar
days, including today, across locations in Pittsburgh time. Both include
one-off and recurring schedules, honor excluded dates, and let matching one-off
entries override recurring ones. Replies include dates, available times, and
location names; events label private bookings. At most 20 entries are shown,
with an explicit overflow notice pointing to the admin panel.

Both commands require a linked site account and read **as that user**, without
the menu-editing gate. Bartenders and lead bartenders can see private events
across locations; other roles follow the Events and Recurring Events collection
rules. Event contact details are never included in Slack schedule summaries.
Food reads also follow collection access. No new Slack scopes or slash-command
registration are required.

`/lolevbeer invite` opens a form to create an admin account for a teammate:
pick them from a Slack member picker, set a name, roles, and (optionally)
locations. The account is created **as the inviter**, so Payload's own rules
decide — `Users.access.create` allows only admins and lead bartenders, and the
collection's `beforeChange` hook caps lead bartenders at creating bartenders
scoped to the inviter's own locations. A lead bartender who picks "Admin" gets
Payload's rejection back in the modal; that rule is never restated in the Slack
handler. The location picker only lists locations the inviter can grant and starts
with those selected. Menu access is location-scoped, so clearing the picker
produces a bartender who cannot edit any menu — it does not mean all
locations. Because the invitee is a
Slack member rather than a typed email, accounts can only be created for people
already in the workspace, the email is workspace-verified, and the new user is
linked (`slackUserId`) from the start. They get a DM with a one-time link to set
their password.

`/lolevbeer password` returns a one-time link to set a new admin password.
Payload's `forgotPassword` runs with `disableEmail: true` here, so the reset
token is delivered only over Slack, as an ephemeral message only the requester
can see (valid 1 hour, single use). It is
not gated by the menu allowlist, since it only ever acts on the caller's own
account — but it does require that account to be linked (below).

The "Forgot password?" form on the `/admin` login page emails the reset link
(see [Email](#email)) and also sends it as a Slack DM to the account's linked
`slackUserId` (`Users.auth.forgotPassword.generateEmailHTML`). Unlinked
accounts get the email only.

### Linking Slack accounts to site users

Users have a `slackUserId` field. The bot resolves a Slack request to a Payload
user by that field first, then falls back to matching the Slack profile email
against the user's email — and on a match it stores the ID, so accounts link
themselves the first time someone uses the bot. When the two addresses differ,
an admin sets the Slack member ID by hand on the user in the admin panel.

Menu reads/writes and schedule reads run **as that Payload user**, so roles and
location scoping are enforced by Payload itself rather than re-implemented in
the Slack handler. A user with no linked account gets a message explaining how
to link it. The identity always comes from Slack's verified profile, never from
an email typed into the command.

Slack app setup (one-time, at api.slack.com/apps):

Donation requests at `/donate`, job applications at `/jobs/[slug]`, and
private-event inquiries from the form on `/private-events` post a summary to Slack
`#events` via `chat.postMessage` (same bot token). Invite the **Lolev Beer**
bot into `#events` or the ping fails with `not_in_channel`. Admins set each
form's channel in Admin → Site Content → Slack Channels (`#name` or a channel
ID); a blank field falls back to `SLACK_DONATION_CHANNEL`, `SLACK_JOBS_CHANNEL`,
or `SLACK_EVENT_INQUIRY_CHANNEL` (the job and inquiry channels fall back to the
donation channel), then `#events`. Invite the bot to any channel you pick, then press **Send test message** under
the field to confirm it can post there (admins only; it tests the typed value,
so save afterwards). Inquiries
land in Admin → Event Inquiries; they never create an Event. Show only
company-paid inquiries with Filters → "Company paying" is "Yes". Each inquiry is
also emailed (see [Email](#email)).

1. **Create New App → From an app manifest** → pick the workspace → paste
   [`docs/slack-app-manifest.yml`](docs/slack-app-manifest.yml). That sets the
   scopes (`commands`, `users:read`, `users:read.email`, `chat:write`,
   `im:write`), the `/lolevbeer` command,
   and all three request URLs in one step. Update that file rather than the
   dashboard when any of them change, so the repo stays the source of truth.
2. **Install to Workspace.**
3. Set env vars: `SLACK_SIGNING_SECRET` (Basic Information → App Credentials)
   and `SLACK_BOT_TOKEN` (OAuth & Permissions → Bot User OAuth Token, `xoxb-…`),
   then redeploy — env changes don't reach existing deployments. There is no
   allowlist env var; see "Who can do what" below.
4. Link yourself: the bot only acts as a linked site user, so confirm your Slack
   profile email matches your admin account's email. If it doesn't, paste your
   Slack member ID (Slack profile → ⋮ → Copy member ID) into **Slack member ID**
   on your user. Everyone else can then be added with `/lolevbeer invite`.

Verify with `/lolevbeer password` first — it exercises identity resolution end
to end and proves the `users:read` + `users:read.email` scope pair is working.
A `missing_scope` error in the logs means one of the two wasn't granted — Slack
requires `users:read` to call `users.info` at all, and `users:read.email` only
adds the email field to the response.

Reset and menu links are built from `NEXT_PUBLIC_SITE_URL`, falling back to the
per-deployment `VERCEL_URL`. Set it to `https://lolev.beer` in production so
links point at the domain rather than a deployment hostname.

### Who can do what

Permissions come from the linked user's Payload roles, so staffing changes
happen in the admin panel and take effect immediately — no env var, no redeploy:

- **Edit menus** — admin, or a bartender/lead bartender at their assigned
  locations, in Slack exactly as in the admin panel (`Menus.access.update`).
  A bartender with no `locations` assigned can edit nothing.
- **Invite teammates** — admin or lead bartender, with lead bartenders limited
  to creating bartenders at their own locations (`Users.access.create` plus the
  collection's `beforeChange` hook).
- **Reset your own password** — anyone with a linked account.
- **Upcoming events and food** — anyone with a linked account, limited to
  content their Payload user may read. Bartenders and lead bartenders see
  private events at every location; contact details are omitted for everyone.
  Days are Pittsburgh calendar days, and food skips inactive locations, as on
  the public /food page.

Every request runs as the requester's Payload user, so these are the collections'
own rules rather than a copy kept in the Slack handler. Someone with no linked
account, or without the right role, gets a message saying so.
