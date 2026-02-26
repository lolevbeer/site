# Newsletter Inline Form

## Problem
The newsletter CTA was a link to an external Square enrollment page. Users leave the site to sign up. We want an inline email form that submits to Square's Customer API without leaving the page.

## Design Decisions
- **Reusable `<NewsletterForm>` client component**: Email input + submit button. Three states: idle, loading, success. Error shown inline.
- **`POST /api/newsletter` server route**: Searches Square for existing customer by email (idempotent), creates if not found. Returns `{ success }` or `{ error }`.
- **Footer placement**: In the center column between nav links and the logo, with a "Stay in the loop" heading.
- **Quick info cards placement**: Third card in the grid (grid changes from 2-col to 3-col on md+).
- **Env vars**: `SQUARE_ACCESS_TOKEN`, `SQUARE_ENVIRONMENT` (sandbox/production).

## Scope

### New files
- `components/ui/newsletter-form.tsx` — Reusable client component
- `src/app/api/newsletter/route.ts` — Server route calling Square API

### Modified files
- `components/layout/footer.tsx` — Add `<NewsletterForm>` to center column
- `components/home/quick-info-cards.tsx` — Add newsletter card, change grid to 3-col

### Not building
- Name collection, double opt-in, unsubscribe flow, submission analytics

## Implementation Steps

1. Create `components/ui/newsletter-form.tsx` with email input, submit, idle/loading/success/error states
2. Create `src/app/api/newsletter/route.ts` with Square Customer API integration (search + create)
3. Add `<NewsletterForm>` to footer center column
4. Add newsletter card to quick info cards grid
5. Add `SQUARE_ACCESS_TOKEN` and `SQUARE_ENVIRONMENT` to `.env.example` / docs
6. Run `tsc --noEmit` to verify
