import { NextResponse } from 'next/server'

import { KIOSK_SUBSCRIBE_CAPABILITY } from '@/lib/ably/channels'
import { getRestClient } from '@/lib/ably/publish'

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
  try {
    const rest = await getRestClient()
    if (!rest) {
      return NextResponse.json({ error: 'Ably is not configured' }, { status: 503 })
    }
    // Default 1 hour TTL; the Realtime SDK renews via this endpoint before expiry.
    const tokenRequest = await rest.auth.createTokenRequest({
      capability: KIOSK_SUBSCRIBE_CAPABILITY,
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
