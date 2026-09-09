import { describe, expect, it } from 'vitest'
import { hashSubmitterIp } from '@/lib/public-forms/ip-hash'

describe('hashSubmitterIp', () => {
  it('is stable for the same ip and secret, and changes when either changes', () => {
    const a = hashSubmitterIp('203.0.113.9', 'secret')
    expect(a).toBe(hashSubmitterIp('203.0.113.9', 'secret'))
    expect(a).not.toBe(hashSubmitterIp('203.0.113.10', 'secret'))
    expect(a).not.toBe(hashSubmitterIp('203.0.113.9', 'other'))
    expect(a).toHaveLength(32)
  })
})
