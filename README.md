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

Slack app setup (one-time, at api.slack.com/apps):

1. Create app → add bot token scope `commands`, install to workspace.
2. Slash command `/lolevbeer` → request URL `https://lolev.beer/api/slack`.
3. Interactivity & Shortcuts → ON, request URL `https://lolev.beer/api/slack`;
   same URL under Select Menus (options load URL).
4. Set env vars: `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`, and optionally
   `SLACK_ALLOWED_USER_IDS` (comma-separated; empty allows the whole workspace).
   Leaving it empty means anyone in the workspace can edit and publish menus: the
   bot writes as system (`overrideAccess`) and so bypasses Payload's
   location-scoped roles — set the allowlist in any shared workspace.

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
