/**
 * Verify Vercel webhook requests. Vercel sends the hex HMAC-SHA1 of the raw
 * request body, keyed with the webhook secret, in `x-vercel-signature`.
 * https://vercel.com/docs/webhooks
 */

import crypto from 'node:crypto'

/** True when `signature` matches the HMAC-SHA1 of `rawBody` under `secret`. */
export function isValidVercelSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false
  const expected = crypto.createHmac('sha1', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
