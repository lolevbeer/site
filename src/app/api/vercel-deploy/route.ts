import { NextResponse } from 'next/server'

import { publishKioskInvalidate } from '@/lib/ably/publish'
import { isValidVercelSignature } from '@/lib/utils/vercel-webhook'

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
 */
export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.VERCEL_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 })
  }

  // Sign the raw body: re-serialized JSON would not match Vercel's signature.
  const rawBody = await request.text()
  if (!isValidVercelSignature(rawBody, request.headers.get('x-vercel-signature'), secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let type: unknown
  try {
    type = (JSON.parse(rawBody) as { type?: unknown }).type
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (type === 'deployment.promoted') {
    void publishKioskInvalidate({ kind: 'menu' })
    void publishKioskInvalidate({ kind: 'events' })
  }
  return NextResponse.json({ ok: true })
}
