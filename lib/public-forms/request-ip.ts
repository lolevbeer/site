/**
 * Best-effort client IP for public form rate limits. Vercel sets
 * `x-forwarded-for`; missing headers count as `unknown` (still throttled).
 */

import { headers } from 'next/headers'

export async function clientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = h.get('x-real-ip')?.trim()
  return (forwarded || realIp || 'unknown').slice(0, 64)
}
