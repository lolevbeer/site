# Ably kiosk realtime spike

Optional realtime invalidate path for the always-on menu (`/m/...`) and
events (`/e/...`) TV displays. Polling stays in place as the fallback; Ably
only accelerates refreshes when CMS content changes.

## Why Ably (not Pusher)

For 12-20 always-on kiosk sockets:

|                        | Ably free            | Pusher Sandbox            |
| ---------------------- | -------------------- | ------------------------- |
| Concurrent connections | 200                  | 100                       |
| Messages               | 6M / month           | 200K / day                |
| Fit for always-on TVs  | Comfortable headroom | Tight on connection count |

Ably wins on concurrent connections and monthly message budget for kiosks
that stay connected all day.

## What this spike does

1. On Payload saves that affect menus or events, the revalidation plugin (and
   beer-driven menu tag invalidation) expires the display caches immediately.
   `after()` publishes a lightweight `updated` message on `kiosk:menu` or
   `kiosk:events` after the save response, so CMS transactions have committed
   before displays refetch. It also keeps the publish alive on Vercel.
2. When `NEXT_PUBLIC_ABLY_ENABLED=true`, displays open an Ably Realtime
   connection authenticated via `/api/ably-auth` (token request, subscribe
   only) and poll the existing stream endpoints immediately on invalidate.
3. While Ably is connected, the warm/fast 10s poll cadence is replaced by a
   120s safety-net poll. If Ably is unset, disabled, or disconnects, the
   original 10s/30s polling state machine is unchanged.
   A failed server publish does not disconnect viewers: the 120s poll still
   fetches saved changes even when no notification arrives.
4. ISR / stream `revalidate` values are **not** changed in this PR.
   Save-triggered invalidation uses `{ expire: 0 }` for menu, event, and location
   caches: `max` would return the old content to the first push-triggered fetch
   and leave it on screen until the 120s fallback poll.

## Setup

### Browser build compatibility

`patches/ably@2.29.0.patch` keeps Ably's two error-constructor helpers compatible
with Next.js 16.3.3 / Turbopack and this project's Safari 15.6 browser target.
Without it, SWC converts their rest-argument arrows into regular functions
containing `super()`, causing a runtime syntax error. Each helper only receives
one message, so the patch uses a single parameter without changing behavior.
Remove the patch when `ably-browser-bundle.int.spec.ts` passes with an unpatched
SDK and the kiosk page loads successfully in the browser.

`ably` is pinned to `2.29.0` in `package.json` so the patch and the version move
together. When bumping it, rename the patch file, update `patchedDependencies`
in `pnpm-workspace.yaml`, and re-run `ably-browser-bundle.int.spec.ts`.

### Environment

1. Create an Ably account and a free-tier app: https://ably.com
2. Create a server API key with **Publish + Subscribe**, restricted to the
   `kiosk:menu` and `kiosk:events` channels. Copy that key into `ABLY_API_KEY`.
   The server publishes refresh signals and signs browser tokens; those tokens
   are restricted to **Subscribe only** by `/api/ably-auth`.
3. Set env vars (Vercel project + local `.env`):

   ```
   ABLY_API_KEY=appId.keyId:keySecret
   NEXT_PUBLIC_ABLY_ENABLED=true
   ```

4. Redeploy. Without both vars, behavior is polling-only (safe default).

### Preview / Production on Vercel

Set both for the **Preview** and **Production** environments (Project → Settings →
Environment Variables). `NEXT_PUBLIC_ABLY_ENABLED` is inlined at build time, so
changing it requires a redeploy of that environment.

| Goal                   | `ABLY_API_KEY`                                   | `NEXT_PUBLIC_ABLY_ENABLED` | Behavior                                                     |
| ---------------------- | ------------------------------------------------ | -------------------------- | ------------------------------------------------------------ |
| Polling only (default) | unset                                            | unset / not `true`         | 10s warm / 30s idle polls; no Ably SDK on the client         |
| Realtime invalidate    | set (Publish + Subscribe on both kiosk channels) | `true`                     | Client opens Ably; CMS publish on save; 120s safety-net poll |

Confirm Preview after deploy: `/api/ably-auth` should return 200 JSON TokenRequest
when both are set, or `{"error":"Ably is not configured"}` (503) when the key is
unset. Kiosk pages must still show `/api/menu-stream/...` or `/api/events-stream/...`
polls every 10s then 30s even when Ably is unset.

### Connected, but edits do not arrive

`Unauthorized to publish to channel` means the server key lacks **Publish**
permission for the target channel. A subscribe-only key can connect displays
but cannot send refresh signals. In Ably → API Keys → Edit configuration,
enable **Publish + Subscribe** for `kiosk:menu` and `kiosk:events`. Reload the
displays after changing capabilities. See [Ably's capability documentation](https://ably.com/docs/auth/capabilities).

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
