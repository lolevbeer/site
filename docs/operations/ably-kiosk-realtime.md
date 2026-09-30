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
   - **Scoped by key:** a menu save carries the menu `url`; event saves carry
     their location slug (a bare relationship id is looked up inside the save
     transaction). A display ignores messages for other keys. If the location
     cannot be resolved or is unset, the message has no key and every display on
     the channel refreshes.
   - **Food saves do not push:** the events kiosk gets food only as a
     server-rendered prop, never through the events stream, so a food,
     recurring-food or vendor save cannot change a stream response. Their public
     page caches are still invalidated.
   - **Location saves push to menu displays only:** menus embed the location
     (hours, lines cleaned) and `kiosk-menus` is hard-expired, so that push is
     fresh. The events stream carries only the location name and its cache is
     just marked stale, so an events push would refetch stale data.
   - **Batched:** all keys for one save go out as a single Ably request, so a
     beer on 30 menus is one round trip. Ably still bills one message per key.
   - **Draft saves are skipped:** Save Draft and autosave (`?draft=true`, status
     stays `draft`) touch neither caches nor Ably, since public pages and kiosks
     only read published documents. Publish, Unpublish and deletes still run.
2. When `NEXT_PUBLIC_ABLY_ENABLED=true`, displays open an Ably Realtime
   connection authenticated via `/api/ably-auth` (token request, subscribe
   only) and poll the existing stream endpoints immediately on invalidate.
   - **The push refetch skips the cache:** a display told to refetch by Ably
     reads `/api/menu-stream/<url>/fresh` (`force-dynamic`, `no-store`, backed by
     the uncached `getMenuByUrlFresh`) instead of the cached stream endpoint.
     Next starts the tag expiry and the `after()` publish together, so the
     first cached read after a push can still return the previous menu
     (`tests/int/menu-update-freshness.int.spec.ts` demonstrates the timing).
     Ordinary 10s/30s/120s polls still use the CDN-cached endpoint; the cost is
     one database read per display per push. The route is public like the
     cached one, so anything can call it and skip the CDN.
   - **Known gap, events displays:** they still refetch the cached events
     endpoint on a push, so the same ordering race can show the previous events.
     Fixing it needs either an uncached events twin or a push that carries the
     saved version so the display retries until it sees it (which would also
     replace `/fresh`).
   - **Connection indicator:** while connected, `/m` boards show a small
     lightning bolt in the bottom-right corner (`RealtimeIndicator`) that flashes
     when a push arrives, so a CMS save is visibly seen reaching the TV. It sits
     in the 3% safe-area gutter so it can never overlap a row or price; a TV
     that crops its outer 3% will not show it (nudge `right`/`bottom` in
     `components/menu/realtime-indicator.tsx` if so). The flash is off under
     `prefers-reduced-motion`.
3. While Ably is connected, the warm/fast 10s poll cadence is replaced by a
   120s safety-net poll. If Ably is unset, disabled, or disconnects, the
   original 10s/30s polling state machine is unchanged.
   A failed server publish does not disconnect viewers: the 120s poll still
   fetches saved changes even when no notification arrives.
4. ISR / stream `revalidate` values are **not** changed in this PR.
   Save-triggered invalidation hard-expires (`{ expire: 0 }`) only the tags the
   kiosk stream responses carry: `kiosk-menus` (menu, location and product
   saves; attached only to `getMenuByUrl`), the per-menu `menu-<url>` tag (beer
   saves) and `events`. `max` would return the old content to the first
   cached read after a save and leave it on screen until the 120s fallback poll.
   The broad `menus` and `locations` tags that public pages share stay
   stale-while-revalidate, so a CMS save never makes a visitor wait for a
   synchronous rebuild. A location rename is not pushed to the events kiosk: the
   first poll after the save triggers the background refresh and a later poll
   shows the new name (a rename is rare, so this is accepted).

## Setup

### Browser build compatibility

The kiosk client imports `ably/modular` (`BaseRealtime` with only the WebSocket
transport and fetch for the auth request) instead of the full SDK: about 37 KiB
gzipped versus 58 KiB (esbuild, minified, for the same connect-and-subscribe
code). The server publish and `/api/ably-auth` keep the Node build via `ably`.

`patches/ably@2.29.0.patch` keeps Ably's two error-constructor helpers compatible
with Next.js 16.3.3 / Turbopack and this project's Safari 15.6 browser target.
Without it, SWC converts their rest-argument arrows into regular functions
containing `super()`, causing a runtime syntax error. Each helper only receives
one message, so the patch uses a single parameter without changing behavior.
Both browser builds have the same helpers, so the patch covers `build/ably.js`
and `build/modular/index.mjs`; the modular file is the one that ships to kiosks.
Remove the patch when `ably-browser-bundle.int.spec.ts` passes both builds with
an unpatched SDK and the kiosk page loads successfully in the browser.

`ably` is pinned to `2.29.0` in `package.json` so the patch and the version move
together. When bumping it, rename the patch file, update `patchedDependencies`
in `pnpm-workspace.yaml`, and re-run `ably-browser-bundle.int.spec.ts`. The
patch's SHA-256 is recorded in `pnpm-lock.yaml` (`patchedDependencies` and the
`patch_hash=` in the `ably` entries); regenerate it with `pnpm patch-commit`
when the patch changes, or a frozen install fails.

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

### Reload displays on deploy

Displays already reload themselves after a code deploy: each stream response
carries `deployId` (the commit SHA), and `usePolling` reloads once the new
deploy's page renders. With Ably connected that check only runs on the 120s
fallback poll, so a Vercel webhook pushes an immediate poll instead.

`POST /api/vercel-deploy` verifies Vercel's `x-vercel-signature` (HMAC-SHA1 of the
raw body) and, on `deployment.promoted`, publishes a keyless invalidate to
`kiosk:menu` and `kiosk:events`. It only says "poll now"; the poll's `deployId`
comparison decides whether to reload. It fires on promotion, not build or boot,
so a poll can't race an older deployment still serving production.

Setup (team **Settings → Webhooks**; requires a Pro or Enterprise team). This is
an outbound webhook, not a Deploy Hook (Deploy Hooks are inbound URLs that trigger
builds):

1. Create a webhook with the **Deployment Promoted** event, this project as the
   target, and the URL `https://<production domain>/api/vercel-deploy`.
2. Copy the secret Vercel shows once into `VERCEL_WEBHOOK_SECRET` for the
   **Production** environment, then redeploy. Unset, the route returns 503.

Without the webhook nothing breaks: displays reload within the 120s fallback.
A redeploy of the same commit (or an env-var-only change) keeps the same
`deployId`, so displays do not reload. "Deployment Promoted" excludes rollbacks
(a separate "Deployment Rollback" event), so after a rollback displays reload on
the fallback poll.

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
