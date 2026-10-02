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

## Visitor navigation

The homepage brings the selected taproom's hours, directions, and menu/schedule
shortcuts ahead of the brand introduction. The beer map puts retailer search
before full taproom information, and beer details prioritize availability and
pricing before artwork on mobile. Food and events identify the selected
location and use compact agendas. These pages share the existing location
selection; the full-screen kiosk layouts remain separate. Existing sections on
the home, location, food, events, and beer detail pages give brief context from
the loaded locations, menus, and schedules, never hardcoded city names or dates.

### Public content and structured data

- **FAQs** — `resolveFAQs` (`lib/utils/faq-schema.ts`) merges the built-in
  FAQs with the CMS FAQs collection. Questions match ignoring case and extra
  whitespace: a CMS entry replaces the built-in answer in place, CMS-only
  entries follow in `order`, and blank entries are dropped. The `/faq` page,
  its FAQPage JSON-LD, and `/llms-full.txt` all use this one list.
- **Beer reviews** — ratings and selected reviews on beer pages link to the
  original Untappd source; reviews without a URL stay unlinked.
- **Schema identity** — the root layout's `SiteJsonLd` is the sitewide owner of
  the Organization (`/#org`), WebSite (`/#website`), and taproom Brewery
  (`/#<slug>`) nodes; IDs live in `lib/utils/schema-shared.ts`. Page schemas
  (home/about Organization, location LocalBusiness) reuse the same IDs to add
  details. Event/FoodEvent `organizer`, WebPage `isPartOf`/`about`, and WebSite
  `publisher` reference them. Do not emit a second WebSite node on a page.
- **Client props** — the home hero, `/food`, and `/events` receive small
  server-derived arrays (`lib/utils/public-client-payloads.ts`) instead of full
  Payload documents. Add a field there only when the client renders it.
- **Breadcrumbs** — `PageBreadcrumbs` renders the visible trail and its
  BreadcrumbList JSON-LD together, including `/beer`, `/events`, and `/food`.
- **Checking pages** — compare `curl` output of the raw HTML (headings, JSON-LD
  blocks, byte size) before and after a change;
  `pnpm exec playwright test -g "raw initial HTML"` covers headings and JSON-LD.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **CMS:** Payload CMS 4 (MongoDB)
- **Styling:** Tailwind CSS 4, shadcn/ui
- **Maps:** Mapbox GL
- **Monitoring:** Sentry
- **Storage:** Vercel Blob
- **Deployment:** Vercel
- **Tests:** Vitest and Playwright

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

- **Beers** — Beer catalog with styles, ABV, pricing, Untappd ratings, and 3D can label textures (generated in the admin from label art + metallic-mask PDFs; rendered by `components/beer/beer-can-3d.tsx`)
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
- **Distributors** — Distribution partners with geocoded locations
- **FAQs** — Frequently asked questions
- **Media** — Image uploads (Vercel Blob storage)
- **Users** — Admin users with role-based access

## Globals

- **Coming Soon** — Upcoming beer announcements
- **Recurring Food** — Year-by-year monthly food truck schedule
- **Site Content** — Editable site-wide content (about page, etc.)

## Slack bot

`/lolevbeer menu` in Slack lists the menus with Edit buttons; the Edit modal
swaps/adds/removes beers. Submitting shows a "Publishing…" view and does the
write in the background (Slack discards a submit response slower than 3s), then
swaps the modal to a confirmation — or an error if the menu can't be published
(not published, has unpublished admin changes, or was edited since the modal
opened). Displays update via the revalidation hooks. The beer typeahead
excludes items already on the menu being edited, except a row's own current
pick so you can revert it. Handler: `src/app/api/slack/route.ts`.

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
There is no email service, so Payload's `forgotPassword` runs with
`disableEmail: true` and the reset token is delivered over Slack instead, as an
ephemeral message only the requester can see (valid 1 hour, single use). It is
not gated by the menu allowlist, since it only ever acts on the caller's own
account — but it does require that account to be linked (below).

The "Forgot password?" form on the `/admin` login page sends the same message
as a Slack DM to the account's linked `slackUserId`
(`Users.auth.forgotPassword.generateEmailHTML`). Unlinked accounts receive
nothing from the form; `/lolevbeer password` links them by email first.

### Linking Slack accounts to site users

Users have a `slackUserId` field. The bot resolves a Slack request to a Payload
user by that field first, then falls back to matching the Slack profile email
against the user's email — and on a match it stores the ID, so accounts link
themselves the first time someone uses the bot. When the two addresses differ,
an admin sets the Slack member ID by hand on the user in the admin panel.

Menu reads and writes then run **as that Payload user**, so roles and
location scoping are enforced by Payload itself rather than re-implemented in
the Slack handler. A user with no linked account gets a message explaining how
to link it. The identity always comes from Slack's verified profile, never from
an email typed into the command.

Slack app setup (one-time, at api.slack.com/apps):

Donation requests at `/donate` and job applications at `/jobs/[slug]` post a
summary to Slack `#events` via `chat.postMessage` (same bot token). Invite the
**Lolev Beer** bot into `#events` or the ping fails with `not_in_channel`.
Override with `SLACK_DONATION_CHANNEL` or `SLACK_JOBS_CHANNEL`.

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

Every request runs as the requester's Payload user, so these are the collections'
own rules rather than a copy kept in the Slack handler. Someone with no linked
account, or without the right role, gets a message saying so.
