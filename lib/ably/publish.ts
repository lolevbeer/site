/**
 * Server-side Ably REST publish for kiosk invalidate signals.
 *
 * Uses Ably.Rest (stateless HTTP) so serverless/CMS hooks never hold a
 * persistent WebSocket. Failures are logged and swallowed: a CMS save must
 * never fail because realtime is down. Polling remains the safety net.
 */

import Ably from 'ably'

import {
  ABLY_CHANNELS,
  ABLY_UPDATED_EVENT,
  type KioskInvalidateKind,
  type KioskInvalidateMessage,
} from '@/lib/ably/channels'
import { isAblyPublishEnabled } from '@/lib/ably/config'
import { logger } from '@/lib/utils/logger'

let restClient: Ably.Rest | null = null

function getRestClient(): Ably.Rest | null {
  if (!isAblyPublishEnabled()) return null
  if (!restClient) {
    restClient = new Ably.Rest({ key: process.env.ABLY_API_KEY!.trim() })
  }
  return restClient
}

function channelForKind(kind: KioskInvalidateKind): string {
  return kind === 'menu' ? ABLY_CHANNELS.menu : ABLY_CHANNELS.events
}

/**
 * Publish a lightweight invalidate. Safe to call from revalidation hooks:
 * returns immediately when Ably is unset, and never throws.
 */
export async function publishKioskInvalidate(input: {
  kind: KioskInvalidateKind
  key?: string
}): Promise<void> {
  const client = getRestClient()
  if (!client) return

  const message: KioskInvalidateMessage = {
    kind: input.kind,
    key: input.key,
    at: Date.now(),
  }

  try {
    const channel = client.channels.get(channelForKind(input.kind))
    await channel.publish(ABLY_UPDATED_EVENT, message)
  } catch (error) {
    logger.warn('Ably kiosk invalidate publish failed', {
      kind: input.kind,
      key: input.key,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/** Test helper: reset the cached REST client between specs. */
export function resetAblyRestClientForTests(): void {
  restClient = null
}
