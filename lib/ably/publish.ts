/**
 * Server-side Ably REST publish for kiosk invalidate signals.
 *
 * Uses Ably.Rest (stateless HTTP) so serverless/CMS hooks never hold a
 * persistent WebSocket. Failures are logged and swallowed: a CMS save must
 * never fail because realtime is down. Polling remains the safety net.
 *
 * Ably is imported only when ABLY_API_KEY is set so CMS revalidation stays a
 * pure revalidateTag/revalidatePath path when Ably is unset (Preview default).
 */

import {
  ABLY_CHANNELS,
  ABLY_UPDATED_EVENT,
  type KioskInvalidateKind,
  type KioskInvalidateMessage,
} from '@/lib/ably/channels'
import { isAblyPublishEnabled } from '@/lib/ably/config'
import { logger } from '@/lib/utils/logger'

type AblyRest = {
  channels: { get: (name: string) => { publish: (event: string, data: unknown) => Promise<void> } }
}

let restClient: AblyRest | null = null
let restClientKey: string | null = null

async function getRestClient(): Promise<AblyRest | null> {
  if (!isAblyPublishEnabled()) return null
  const key = process.env.ABLY_API_KEY!.trim()
  if (restClient && restClientKey === key) return restClient

  const Ably = (await import('ably')).default
  restClient = new Ably.Rest({ key }) as unknown as AblyRest
  restClientKey = key
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
  let client: AblyRest | null
  try {
    client = await getRestClient()
  } catch (error) {
    logger.warn('Ably REST client init failed', {
      kind: input.kind,
      key: input.key,
      error: error instanceof Error ? error.message : String(error),
    })
    return
  }
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
  restClientKey = null
}
