import crypto from 'node:crypto'

import { NextResponse } from 'next/server'

import { publishKioskInvalidate } from '@/lib/ably/publish'

/**
 * Vercel `deployment.promoted` webhook: pushes a keyless Ably invalidate to
 * every kiosk display the moment production serves the new deployment.
 *
 * Displays poll immediately, see the new `deployId`, and reload through the
 * existing check in usePolling, so this only says "poll now" and never
 * "reload". Fires on promotion, not build or boot, so the poll can't race an
 * old deployment still serving production.
 *
 * Returns 503 when VERCEL_WEBHOOK_SECRET is unset so the endpoint is inert.
 * https://vercel.com/docs/webhooks
 */
export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.VERCEL_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 })
  }

  // Sign the raw body: re-serialized JSON would not match Vercel's signature.
  const rawBody = await request.text()
  if (!isValidSignature(rawBody, request.headers.get('x-vercel-signature'), secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // The signature proves Vercel sent this body, so it is trusted JSON.
  const { type } = JSON.parse(rawBody) as { type?: string }
  if (type === 'deployment.promoted') {
    for (const kind of ['menu', 'events'] as const) void publishKioskInvalidate({ kind })
  }
  return NextResponse.json({ ok: true })
}

/** Vercel sends the hex HMAC-SHA1 of the raw body, keyed with the webhook secret. */
function isValidSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = Buffer.from(crypto.createHmac('sha1', secret).update(rawBody).digest('hex'))
  const actual = Buffer.from(signature)
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}
