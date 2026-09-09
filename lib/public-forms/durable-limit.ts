/**
 * Mongo-backed IP hash counter so public forms still throttle across
 * Vercel isolates. Complements the in-memory sliding window.
 */

import type { Payload } from 'payload'
import { PUBLIC_FORM_IP_MAX, PUBLIC_FORM_IP_WINDOW_MS } from './rate-limit'

export async function hasReachedIpHashLimit(
  payload: Payload,
  collection: 'donation-requests' | 'job-applications',
  ipHash: string,
): Promise<boolean> {
  const since = new Date(Date.now() - PUBLIC_FORM_IP_WINDOW_MS).toISOString()
  const result = await payload.find({
    collection,
    where: {
      and: [{ ipHash: { equals: ipHash } }, { createdAt: { greater_than_equal: since } }],
    },
    limit: PUBLIC_FORM_IP_MAX,
    overrideAccess: true,
  })
  return result.docs.length >= PUBLIC_FORM_IP_MAX
}
