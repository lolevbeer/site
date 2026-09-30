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

import type { Rest } from 'ably'
import { after } from 'next/server'
import {
  ABLY_CHANNELS,
  ABLY_UPDATED_EVENT,
  type KioskInvalidateKind,
  type KioskInvalidateMessage,
} from '@/lib/ably/channels'
import { isAblyPublishEnabled } from '@/lib/ably/config'
import { logger } from '@/lib/utils/logger'

let restClient: Rest | null = null
let restClientKey: string | null = null

/** Cached REST client, or null when ABLY_API_KEY is unset. Shared with /api/ably-auth. */
export async function getRestClient(): Promise<Rest | null> {
  if (!isAblyPublishEnabled()) return null
  const key = process.env.ABLY_API_KEY!.trim()
  if (restClient && restClientKey === key) return restClient

  const Ably = (await import('ably')).default
  restClient = new Ably.Rest({ key })
  restClientKey = key
  return restClient
}

/** `keys` = the menu urls or location slugs to refresh; none = every display on the channel. */
interface KioskInvalidateInput {
  kind: KioskInvalidateKind
  keys?: string[]
}

/**
 * Queue lightweight invalidates after the save response. Payload afterChange
 * runs before the transaction commits; publishing there can make displays
 * refetch the old document. after() also keeps serverless publishes alive.
 *
 * All keys go out as one REST request (Ably accepts an array of messages), so a
 * beer on 30 menus costs one round trip, not 30. Ably still bills per message.
 */
export async function publishKioskInvalidate(input: KioskInvalidateInput): Promise<void> {
  if (!isAblyPublishEnabled()) return
  try {
    after(() => publish(input))
  } catch (error) {
    logger.warn('Ably kiosk invalidate scheduling failed', {
      kind: input.kind,
      keys: input.keys,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function publish({ kind, keys }: KioskInvalidateInput): Promise<void> {
  let client: Rest | null
  try {
    client = await getRestClient()
  } catch (error) {
    logger.warn('Ably REST client init failed', {
      kind,
      keys,
      error: error instanceof Error ? error.message : String(error),
    })
    return
  }
  if (!client) return

  const at = Date.now()
  // No keys: one keyless message that every display on the channel acts on.
  const messages = (keys?.length ? keys : [undefined]).map((key) => ({
    name: ABLY_UPDATED_EVENT,
    data: { kind, key, at } satisfies KioskInvalidateMessage,
  }))

  try {
    await client.channels.get(ABLY_CHANNELS[kind]).publish(messages)
  } catch (error) {
    logger.warn('Ably kiosk invalidate publish failed', {
      kind,
      keys,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/** Test helper: reset the cached REST client between specs. */
export function resetAblyRestClientForTests(): void {
  restClient = null
  restClientKey = null
}
