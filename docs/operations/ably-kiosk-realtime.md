# Ably kiosk realtime spike

Optional realtime invalidate path for the always-on menu (`/m/...`) and
events (`/e/...`) TV displays. Polling stays in place as the fallback; Ably
only accelerates refreshes when CMS content changes.

## Why Ably (not Pusher)

For 12-20 always-on kiosk sockets:

| | Ably free | Pusher Sandbox |
|---|---|---|
| Concurrent connections | 200 | 100 |
| Messages | 6M / month | 200K / day |
| Fit for always-on TVs | Comfortable headroom | Tight on connection count |

Ably wins on concurrent connections and monthly message budget for kiosks
that stay connected all day.

## What this spike does

1. On Payload saves that affect menus or events, the revalidation plugin (and
   beer-driven menu tag invalidation) publishes a lightweight `updated`
   message on `kiosk:menu` or `kiosk:events`.
2. When `NEXT_PUBLIC_ABLY_ENABLED=true`, displays open an Ably Realtime
   connection authenticated via `/api/ably-auth` (token request, subscribe
   only) and poll the existing stream endpoints immediately on invalidate.
3. While Ably is connected, the warm/fast 10s poll cadence is replaced by a
   120s safety-net poll. If Ably is unset, disabled, or disconnects, the
   original 10s/30s polling state machine is unchanged.
4. ISR / stream `revalidate` values are **not** changed in this PR.

## Setup

1. Create an Ably account and a free-tier app: https://ably.com
2. Copy the root API key (or a key that can publish and create token requests).
3. Set env vars (Vercel project + local `.env`):

   ```
   ABLY_API_KEY=appId.keyId:keySecret
   NEXT_PUBLIC_ABLY_ENABLED=true
   ```

4. Redeploy. Without both vars, behavior is polling-only (safe default).

## Verify with 12-20 TVs

1. Open `/m/<menuUrl>` and `/e/<location>` on the kiosk browsers (or
   duplicates in desktop windows).
2. Confirm each display's network tab shows a WebSocket to Ably after load,
   and that `/api/ably-auth` returns 200 JSON TokenRequests.
3. In Payload, edit a beer on a live menu (or an event). The matching
   display should refetch `/api/menu-stream/...` or `/api/events-stream/...`
   within a second or two, without waiting for the next idle poll.
4. In the Ably dashboard, confirm concurrent connections ≈ number of open
   kiosk tabs (expect ≤ 20 for the brewery), and that publish volume is a
   few messages per CMS edit (not continuous).
5. Turn off `NEXT_PUBLIC_ABLY_ENABLED` (or unset `ABLY_API_KEY`) and confirm
   displays still update via polling alone.

## Rollback

- Unset `NEXT_PUBLIC_ABLY_ENABLED` and/or `ABLY_API_KEY`, redeploy: clients
  stop connecting; publishes no-op; polling unchanged.
- Or revert this PR. No schema or ISR changes to unwind.

## Cost notes

Free tier caps (200 connections, 6M msgs/mo) are far above 12-20 TVs with
invalidate-only traffic. Do not ship the root API key to the client; token
auth keeps keys server-side and scopes kiosks to subscribe-only.
