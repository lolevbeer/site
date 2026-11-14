# Sign in with Lolev: connecting another app

Staff can sign in to another app with their Lolev admin account. This site
(`https://lolev.beer`) is the identity provider. The other app sends the user
here, they sign in and click **Allow**, and the app gets a short-lived signed
token saying who they are. The app then runs its own session.

The site side lives in `src/plugins/sso.ts`. This page is everything the other
app needs.

## What kind of app can use this

- **An app with a server** (any framework): yes. This is the intended case.
- **A CLI or desktop app**: yes, with a `http://localhost:<port>/...` callback.
- **A browser-only app** (for example GitHub Pages): it can run the sign-in and
  learn who the user is, but it cannot keep anything private. Its files are
  public, it must never hold `SSO_TOKEN_SECRET`, and the token cannot call this
  site's API. Its origin must also be in `allowedOrigins` in
  `src/payload.config.ts`, or the browser blocks the code exchange.
- **A job with no person present** (cron, script): no. Every sign-in needs
  someone in a browser to click Allow.

## Protocol facts

- OAuth 2 authorization code flow with PKCE (`S256`). Public client: there is
  no client secret.
- Not OpenID Connect. No ID token is issued, so use a plain OAuth 2 client or
  plain `fetch`, not an OIDC library.
- No refresh token and no single sign-out.

| What              | Value                                           |
| ----------------- | ----------------------------------------------- |
| Issuer            | `https://lolev.beer/api/mcp/oauth`              |
| Discovery         | `GET <issuer>/.well-known/openid-configuration` |
| Register a client | `POST <issuer>/register`                        |
| Send the user     | `GET <issuer>/authorize`                        |
| Exchange the code | `POST <issuer>/token`                           |

Preview deployments are their own issuer, at their own domain.

## One-time setup

### 1. Choose the callback URL

It is the address in the other app where the browser lands after Allow, for
example `https://staff.example.com/auth/lolev/callback`. Rules:

- `https` only, except `http://localhost`, `http://127.0.0.1` and `http://[::1]`
  for local development.
- No `#fragment`.
- It is matched character for character, so decide on the trailing slash.

### 2. Allow it on this site (a site admin does this in Vercel)

- Add the callback URL to `SSO_REDIRECT_URIS` (comma-separated list). Anything
  not on the list is refused with a 400.
- `SSO_TOKEN_SECRET` signs the token. Give the same value to the other app's
  server. It is stored hidden in Vercel and cannot be read back, so set it on
  both sides at the same time. Use a different value for Production and Preview.

Both take effect on the next deployment. Nothing can sign in until both are set.

### 3. Register the app and keep its `client_id`

```sh
curl -s https://lolev.beer/api/mcp/oauth/register \
  -H 'Content-Type: application/json' \
  -d '{"client_name":"Staff app","redirect_uris":["https://staff.example.com/auth/lolev/callback"]}'
```

Store the returned `client_id` in the other app's config. It is not secret. It
stays valid until this site's `PAYLOAD_SECRET` changes, and it only works on
the environment that issued it. `client_name` is what staff see on the Allow
page.

## The sign-in, step by step

### 1. Start: redirect the browser to `authorize`

Create two random values and keep them in a short-lived, `HttpOnly`, `Secure`,
`SameSite=Lax` cookie:

- `state`: any random string.
- `code_verifier`: 32 random bytes, base64url.

Redirect to `<issuer>/authorize` with these query parameters:

| Parameter               | Value                                       |
| ----------------------- | ------------------------------------------- |
| `client_id`             | from registration                           |
| `redirect_uri`          | the callback URL. Always send it.           |
| `response_type`         | `code`                                      |
| `code_challenge`        | base64url of the SHA-256 of `code_verifier` |
| `code_challenge_method` | `S256`                                      |
| `state`                 | the random `state`                          |

The user signs in here if they are not already, then sees the Allow page. It is
Payload's own page and mentions "MCP tools"; none are exposed.

### 2. Callback: check what came back

The browser returns to the callback URL with either:

- `code`, `state` and `iss`, or
- `error=access_denied`, `state` and `iss` when the user clicked Deny.

Reject the request unless `state` equals the cookie value and `iss` equals the
issuer.

### 3. Exchange the code, from the server

`POST <issuer>/token` as `application/x-www-form-urlencoded`:

| Field           | Value                |
| --------------- | -------------------- |
| `grant_type`    | `authorization_code` |
| `client_id`     | from registration    |
| `code`          | from the callback    |
| `code_verifier` | from the cookie      |

The code is valid for 60 seconds. The response is:

```json
{ "access_token": "<JWT>", "expires_in": 300, "token_type": "Bearer" }
```

### 4. Verify the token and start a session

`access_token` is a JWT signed with HS256 using `SSO_TOKEN_SECRET`. Verify the
signature, accept only `HS256`, and check `exp`. Its claims:

| Claim   | Meaning                                                                                        |
| ------- | ---------------------------------------------------------------------------------------------- |
| `sub`   | Lolev user ID. Use this as the stable key, not the email.                                      |
| `email` | The staff member's email                                                                       |
| `name`  | Their name (may be empty)                                                                      |
| `roles` | Any of `admin`, `event-manager`, `beer-manager`, `food-manager`, `lead-bartender`, `bartender` |
| `exp`   | 5 minutes after it was issued                                                                  |

Then start the app's own session, clear the temporary cookie, and discard the
token.

## Reference implementation (Node, no libraries)

```ts
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const ISSUER = 'https://lolev.beer/api/mcp/oauth'

/** Reads a required setting, so a missing one fails at startup rather than mid sign-in. */
function setting(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}
const LOLEV_SSO_CLIENT_ID = setting('LOLEV_SSO_CLIENT_ID')
const LOLEV_SSO_TOKEN_SECRET = setting('LOLEV_SSO_TOKEN_SECRET')
const LOLEV_SSO_CALLBACK = setting('LOLEV_SSO_CALLBACK')

/** Step 1: returns the URL to redirect to, and the two values to keep in a cookie. */
export function startSignIn() {
  const state = randomBytes(16).toString('base64url')
  const verifier = randomBytes(32).toString('base64url')
  const params = new URLSearchParams({
    client_id: LOLEV_SSO_CLIENT_ID,
    redirect_uri: LOLEV_SSO_CALLBACK,
    response_type: 'code',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    state,
  })
  return { url: `${ISSUER}/authorize?${params}`, state, verifier }
}

/** Steps 2 to 4: returns the signed-in staff member, or throws. */
export async function finishSignIn(
  query: URLSearchParams,
  saved: { state: string; verifier: string },
) {
  if (query.get('error')) throw new Error('Sign-in was declined')
  if (query.get('state') !== saved.state || query.get('iss') !== ISSUER) {
    throw new Error('Sign-in response does not match the request')
  }
  const response = await fetch(`${ISSUER}/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: LOLEV_SSO_CLIENT_ID,
      code: query.get('code') ?? '',
      code_verifier: saved.verifier,
    }),
  })
  if (!response.ok) throw new Error('Sign-in code was refused')
  const { access_token } = await response.json()

  const [header, body, signature] = access_token.split('.')
  const expected = createHmac('sha256', LOLEV_SSO_TOKEN_SECRET).update(`${header}.${body}`).digest()
  const given = Buffer.from(signature, 'base64url')
  const { alg } = JSON.parse(Buffer.from(header, 'base64url').toString())
  if (alg !== 'HS256' || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new Error('Token signature is not valid')
  }
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString())
  if (claims.exp * 1000 < Date.now()) throw new Error('Token has expired')
  return { id: claims.sub, email: claims.email, name: claims.name, roles: claims.roles as string[] }
}
```

## Rules for the other app

- Only trust a token your server fetched itself from the token endpoint. Never
  accept one from the browser, a header or a query string.
- Keep `SSO_TOKEN_SECRET` on the server. Anyone who has it can forge a sign-in.
- The token says who someone was at sign-in. It cannot call this site's API,
  and it is not a Payload login.
- Removing or demoting a staff member here does not end their session in the
  other app. Keep that session short (12 hours or less) and send the user
  through sign-in again when it ends.
- Map `roles` to the app's permissions in one place, and deny by default.

## When it fails

| What you see                                   | Cause                                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| 400 "This app is not allowed to sign in here." | The callback is not in `SSO_REDIRECT_URIS`, differs by a character, or was not sent.   |
| "This sign-in link is invalid" page            | Unknown `client_id` (wrong environment, or `PAYLOAD_SECRET` changed), or missing PKCE. |
| "This sign-in request expired" page            | The Allow page was left open more than 20 minutes, or a different user is signed in.   |
| Clicking Allow returns a 503                   | `SSO_TOKEN_SECRET` is not set on this site.                                            |
| Token endpoint answers `invalid_grant`         | Code older than 60 seconds, wrong `code_verifier`, or wrong `client_id`.               |
| Signature check fails                          | The two sides hold different `SSO_TOKEN_SECRET` values (Production versus Preview).    |
| Signed-in staff are asked to log in again      | A browser that sends no `Sec-Fetch-Site` header. They can sign in and continue.        |
