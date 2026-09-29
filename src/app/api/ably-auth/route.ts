import { NextResponse } from 'next/server'

import { KIOSK_SUBSCRIBE_CAPABILITY } from '@/lib/ably/channels'
import { isAblyPublishEnabled } from '@/lib/ably/config'

/**
 * Mints short-lived Ably TokenRequests for kiosk displays.
 *
 * Prefer token auth over shipping ABLY_API_KEY to the browser. Tokens are
 * subscribe-only on the kiosk channels. Returns 503 when Ably is not
 * configured so clients fall back to polling.
 *
 * Force-dynamic: every call needs a fresh TokenRequest signature.
 */
export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  if (!isAblyPublishEnabled()) {
    return NextResponse.json({ error: 'Ably is not configured' }, { status: 503 })
  }

  try {
    const Ably = (await import('ably')).default
    const rest = new Ably.Rest({ key: process.env.ABLY_API_KEY!.trim() })
    const tokenRequest = await rest.auth.createTokenRequest({
      // Stable-ish client id per mint is fine; Ably allows many clients.
      clientId: `kiosk-${Date.now().toString(36)}`,
      capability: KIOSK_SUBSCRIBE_CAPABILITY,
      // 1 hour; the Realtime SDK renews via this endpoint before expiry.
      ttl: 60 * 60 * 1000,
    })
    return NextResponse.json(tokenRequest)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to create Ably token',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
