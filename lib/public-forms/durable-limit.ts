/** Atomic rolling-window reservations; system-only derived state, never exposed through Payload. */
import { randomUUID } from 'node:crypto'
import type { Payload } from 'payload'
import { PUBLIC_FORM_IP_MAX, PUBLIC_FORM_IP_WINDOW_MS } from './rate-limit'

export async function reserveIpHashSlot(
  payload: Payload,
  scope: 'donation-requests' | 'job-applications',
  ipHash: string,
): Promise<(() => Promise<void>) | null> {
  const slots = payload.db.connection.db!.collection<{
    _id: string
    expiresAt: Date
    token: string
  }>('public-form-limits')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + PUBLIC_FORM_IP_WINDOW_MS)
  const token = randomUUID()
  for (let slot = 0; slot < PUBLIC_FORM_IP_MAX; slot++) {
    const _id = `${scope}:${ipHash}:${slot}`
    try {
      await slots.updateOne(
        { _id, expiresAt: { $lte: now } },
        { $set: { expiresAt, token } },
        { upsert: true },
      )
      return async () => {
        await slots.deleteOne({ _id, token })
      }
    } catch (error) {
      // A live slot cannot match, and _id's built-in unique index rejects the upsert.
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000))
        throw error
    }
  }
  return null
}
