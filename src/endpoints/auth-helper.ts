import type { Payload, PayloadRequest } from 'payload'

/**
 * Resolve the authenticated user for a custom Payload endpoint.
 *
 * Delegates to `payload.auth`, which verifies the `payload-token` JWT signature
 * against the configured secret and applies expiry/strategy checks. Used as a
 * fallback for the rare cases where `req.user` isn't pre-populated by Payload's
 * middleware (e.g. some streaming/SSE requests on Vercel).
 *
 * Returns null when there is no valid session. Never decode/trust a token
 * without signature verification — a forged JWT payload must not authenticate.
 */
export async function getUserFromRequest(req: PayloadRequest, payload: Payload) {
  try {
    const { user } = await payload.auth({ headers: req.headers })
    return user ?? null
  } catch {
    return null
  }
}
