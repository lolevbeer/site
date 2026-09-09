/**
 * Hash a client IP for durable public-form rate limits. Store the digest, never
 * the raw address.
 */

import { createHash } from 'crypto'

export function hashSubmitterIp(ip: string, secret: string): string {
  return createHash('sha256').update(`${ip}\0${secret}`).digest('hex').slice(0, 32)
}
