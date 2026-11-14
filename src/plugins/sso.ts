/**
 * Single sign-on for our other apps.
 *
 * Staff sign in here once. An app on another domain sends them to Payload's
 * built-in OAuth server (it ships inside @payloadcms/plugin-mcp, under
 * /api/mcp/oauth), they click Allow, and the app gets back a short-lived signed
 * token saying who they are. The app then starts its own session.
 * How another app connects: docs/sso-for-other-apps.md.
 *
 * Four things differ from the plugin's defaults:
 *  - Only the callback URLs in SSO_REDIRECT_URIS can receive a sign-in. The
 *    plugin lets anyone register a client, so without this any site could ask
 *    staff to "Allow" it.
 *  - A staff member who is already signed in here is not asked to sign in
 *    again when the other app sends them over (see the reload in
 *    guardAuthorize).
 *  - The token is an identity token (issueSsoToken), not a Payload login. It
 *    cannot open the admin or the REST API.
 *  - The MCP endpoint the plugin also mounts (/api/mcp) offers no tools.
 */

import { mcpPlugin } from '@payloadcms/plugin-mcp'
import {
  APIError,
  definePlugin,
  jwtSign,
  type PayloadHandler,
  type PayloadRequest,
  type Plugin,
} from 'payload'

/** Seconds a token stays valid. The app reads it once, then keeps its own session. */
const TOKEN_TTL_SECONDS = 300

/** Query flag marking an authorize request that already reloaded through our own page. */
const RELOADED = 'sso_reloaded'

/** Exact callback URLs that may receive a sign-in: SSO_REDIRECT_URIS, comma-separated. */
function allowedRedirectURIs(): string[] {
  return (process.env.SSO_REDIRECT_URIS ?? '')
    .split(',')
    .map((uri) => uri.trim())
    .filter(Boolean)
}

/**
 * Creates the token an app gets after a staff member clicks Allow: who they are
 * (`sub`, `email`, `name`, `roles`), signed with SSO_TOKEN_SECRET (HS256).
 * It carries no `id` or `collection`, which Payload requires of its own login
 * tokens, so it can never be used as one.
 */
async function issueSsoToken({ req }: { req: PayloadRequest }) {
  const secret = process.env.SSO_TOKEN_SECRET?.trim()
  if (!secret || !req.user) throw new APIError('Single sign-on is not configured', 503)
  const { id, email, name, roles } = req.user
  const { token } = await jwtSign({
    fieldsToSign: { sub: String(id), email, name, roles },
    secret,
    tokenExpiration: TOKEN_TTL_SECONDS,
  })
  return { accessToken: token, expiresIn: TOKEN_TTL_SECONDS }
}

const oauthServer = mcpPlugin({
  oauth: { type: 'builtin', issueToken: issueSsoToken },
  // We use the plugin for its OAuth server only. Treat every MCP request as
  // signed out and allow it nothing, so /api/mcp only ever answers 401.
  overrideGetAuthorizedMCP: ({ req }) => {
    req.user = null
    return { items: [], overrideAccess: false }
  },
})

/**
 * Wraps Payload's authorize handler: refuses callbacks that are not on the
 * allowlist, and reloads cross-site arrivals once so the session counts.
 */
function guardAuthorize(authorize: PayloadHandler): PayloadHandler {
  return (req) => {
    const url = req.url ? new URL(req.url) : null
    // Required, not optional: without it Payload falls back to the one URL
    // the client registered, which nothing has checked.
    const redirectURI = url?.searchParams.get('redirect_uri')
    if (!url || !redirectURI || !allowedRedirectURIs().includes(redirectURI)) {
      return new Response('This app is not allowed to sign in here.', { status: 400 })
    }
    // A browser sent here by the other app makes a cross-site request, and
    // Payload ignores the session cookie on those, so a signed-in staff
    // member would get the login form again. Reload the same address from
    // a page of our own: that request is same-origin and their session
    // counts. RELOADED keeps it to one reload.
    if (req.headers.get('Sec-Fetch-Site') === 'cross-site' && !url.searchParams.has(RELOADED)) {
      url.searchParams.set(RELOADED, '1')
      const target = (url.pathname + url.search).replaceAll('&', '&amp;')
      return new Response(`<!doctype html><meta http-equiv="refresh" content="0;url=${target}">`, {
        headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/html; charset=utf-8' },
      })
    }
    return authorize(req)
  }
}

/**
 * Puts guardAuthorize in front of Payload's authorize endpoint, the one step
 * every sign-in passes through. Runs after the MCP plugin (order 10), which
 * adds that endpoint.
 */
const redirectAllowlist = definePlugin({
  slug: 'sso-redirect-allowlist',
  order: 20,
  plugin: ({ config }) => {
    let guarded = false
    const endpoints = (config.endpoints ?? []).map((endpoint) => {
      if (endpoint.method !== 'get' || endpoint.path !== '/mcp/oauth/authorize') return endpoint
      guarded = true
      return { ...endpoint, handler: guardAuthorize(endpoint.handler) }
    })
    // Fail the build rather than run without the allowlist if a Payload upgrade moves the endpoint.
    if (!guarded) throw new Error('SSO: authorize endpoint not found, allowlist not applied')
    return { ...config, endpoints }
  },
})()

export const ssoPlugins: Plugin[] = [oauthServer, redirectAllowlist]
