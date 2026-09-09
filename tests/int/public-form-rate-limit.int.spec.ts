/**
 * In-memory sliding window used by public donate/job actions.
 */
import { describe, expect, it } from 'vitest'
import {
  allowAttempt,
  resetPublicFormRateLimit,
} from '@/lib/public-forms/rate-limit'

describe('allowAttempt', () => {
  it('allows up to max hits then rejects inside the window', () => {
    resetPublicFormRateLimit()
    const now = 1_000_000
    expect(allowAttempt('t', 2, 1000, now)).toBe(true)
    expect(allowAttempt('t', 2, 1000, now + 1)).toBe(true)
    expect(allowAttempt('t', 2, 1000, now + 2)).toBe(false)
    expect(allowAttempt('t', 2, 1000, now + 1001)).toBe(true)
  })
})
