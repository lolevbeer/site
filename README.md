# Lolev Beer

Brewery website built with Next.js 15 and Payload CMS 3, deployed on Vercel.

## Setup

1. Clone the repo
2. `cp .env.example .env` and fill in your values
3. `pnpm install && pnpm dev`
4. Open `http://localhost:3000`

Payload admin is at `/admin`. Follow the on-screen instructions to create your first admin user.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **CMS:** Payload CMS 3 (MongoDB)
- **Styling:** Tailwind CSS 4, shadcn/ui
- **Maps:** Mapbox GL
- **Monitoring:** Sentry
- **Storage:** Vercel Blob
- **Deployment:** Vercel

## Collections

- **Beers** - Beer catalog with styles, ABV, pricing, Untappd ratings, and 3D can label textures (generated in the admin from label art + metallic-mask PDFs; rendered by `components/beer/beer-can-3d.tsx`)
- **Styles** - Beer style definitions
- **Menus** - Draft and can menus per location
- **Products** - Menu items linking beers to menus
- **Events** - Brewery events calendar
- **Food** - Food truck schedule
- **Food Vendors** - Food truck vendor directory
- **Locations** - Brewery locations with hours
- **Holiday Hours** - Holiday hour overrides
- **Distributors** - Distribution partners with geocoded locations
- **FAQs** - Frequently asked questions
- **Media** - Image uploads (Vercel Blob storage)
- **Users** - Admin users with role-based access

## Globals

- **Coming Soon** - Upcoming beer announcements
- **Recurring Food** - Weekly food truck schedule
- **Site Content** - Editable site-wide content (about page, etc.)

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
collection's `beforeChange` hook caps lead bartenders at creating bartenders.
A lead bartender who picks "Admin" gets Payload's rejection back in the modal;
that rule is never restated in the Slack handler. Because the invitee is a
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

1. **Create New App → From an app manifest** → pick the workspace → paste
   [`docs/slack-app-manifest.yml`](docs/slack-app-manifest.yml). That sets the
   scopes (`commands`, `users:read.email`, `im:write`), the `/lolevbeer` command,
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
to end and proves the `users:read.email` scope is working.

Reset and menu links are built from `NEXT_PUBLIC_SITE_URL`, falling back to the
per-deployment `VERCEL_URL`. Set it to `https://lolev.beer` in production so
links point at the domain rather than a deployment hostname.

### Who can do what

Permissions come from the linked user's Payload roles, so staffing changes
happen in the admin panel and take effect immediately — no env var, no redeploy:

- **Edit menus** — admin, bartender, or lead bartender. Bartenders with
  `locations` assigned can only edit those locations' menus, in Slack exactly as
  in the admin panel (`Menus.access.update`).
- **Invite teammates** — admin or lead bartender, with lead bartenders limited
  to creating bartenders (`Users.access.create` plus the collection's
  `beforeChange` hook).
- **Reset your own password** — anyone with a linked account.

Every request runs as the requester's Payload user, so these are the collections'
own rules rather than a copy kept in the Slack handler. Someone with no linked
account, or without the right role, gets a message saying so.

## Scripts

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm type-check       # TypeScript check
pnpm lint             # ESLint
pnpm test:int         # Integration tests (vitest)
pnpm test:e2e         # E2E tests (playwright)
pnpm generate:types   # Regenerate Payload types
pnpm generate:importmap  # Regenerate Payload import map
```
