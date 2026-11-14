/**
 * Shared check for the Vercel cron routes in this folder. Vercel sends
 * `Authorization: Bearer $CRON_SECRET` on scheduled invocations; anyone else
 * hitting the URL is refused. With no secret configured, everyone is refused.
 */
import type { NextRequest } from 'next/server'

export function isCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}
