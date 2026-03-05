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

- **Beers** - Beer catalog with styles, ABV, pricing, Untappd ratings
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
