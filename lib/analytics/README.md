# Analytics

The public site reports to two places:

- **Google Analytics 4** (`G-RR14DE5FPS`, hardcoded in `components/analytics/google-analytics.tsx`, loaded `lazyOnload`).
- **Vercel Web Analytics** (`<Analytics />` from `@vercel/analytics/next` in `src/app/(frontend)/layout.tsx`).

Helpers live in `lib/analytics/events.ts`:

- `trackEvent(name, params)` sends a GA event only. It is a no-op until `window.gtag` exists.
- `trackConversion(name, params)` sends the same event to Vercel Analytics (`track`) and to GA.

## Events sent

### Page views

- GA sends page views itself (the `config` call on load, and enhanced measurement's history-change tracking for client-side navigation, which only counts while the GA4 property's "Page changes based on browser history events" setting is on). There is no custom page-view tracker; adding one double-counts.
- Vercel Analytics records page views automatically.

### Conversions (Vercel Analytics and GA)

| Event | Params | Sent from |
| --- | --- | --- |
| `call` | none | Any click on a `tel:` link (`components/analytics/conversion-tracker.tsx`) |
| `directions` | `page` (path the click happened on) | Any click on a Google Maps link (`google.com/maps…` or any `*.google.com/maps…`, `maps.google.com`, the share links `maps.app.goo.gl/…` and `goo.gl/maps/…`) or an Apple Maps link (`maps.apple.com`). This is the directions KPI. |
| `outbound` | `host` | Any click on another off-site `http(s)` link |
| `donate_submitted` | none | `components/donate/donation-request-form.tsx`, when the server accepts the request |
| `job_submitted` | none | `components/jobs/job-apply-form.tsx`, when the server accepts the application |

`ConversionTracker` is a delegated `document` listener for `click` and middle-button `auxclick` (open in new tab) mounted next to `<Analytics />` in the frontend layout, so links need no per-link wiring. It cannot see a link opened from the right-click context menu or by long-press on a phone, so `call`, `directions`, and `outbound` slightly undercount those. `mailto:` and other non-http links are ignored.

### GA-only events

| Event | Params | Sent from |
| --- | --- | --- |
| `view_beer` | `beer_name`, `beer_type` | `components/beer/beer-card.tsx` |
| `map_interaction` | `action` (`geolocate`, `marker_click`, `card_click`), `location` | `components/ui/distributor-map.tsx` |

The old GA-only `get_directions` event (location cards only) was retired; use `directions`, which covers every maps link. GA4's own enhanced measurement (scroll, outbound clicks, file downloads, video) also runs if it is enabled on the property, so a GA outbound-click report can include maps clicks; use `directions` for directions.

### Field Web Vitals

The baseline for real-user Web Vitals (LCP, INP, CLS) comes from Sentry. `@sentry/nextjs` adds its browser tracing integration by default (`instrumentation-client.ts`, options in `sentry.options.ts`), which records Web Vitals on sampled page-load transactions (`tracesSampleRate: 0.2`). That only runs in production when `NEXT_PUBLIC_SENTRY_DSN` is set. If the DSN stays unset, there is no field-vitals source; the plan is then to add `<SpeedInsights />` from `@vercel/speed-insights/next` next to `<Analytics />`.

## Adding an event

Add a helper to `lib/analytics/events.ts` (use `trackConversion` for anything you want in Vercel Analytics), call it from the component, and add a row to the tables above. Vercel Analytics custom-event properties must be strings, numbers, booleans, or null. Never send personal information.

## Checking it works

- GA: Network tab, filter `collect`; or GA4 → Reports → Realtime.
- Vercel: the project's Analytics → Events tab (custom events need a Vercel plan that includes them). In development `track` logs to the console instead of sending.
