/**
 * Polling interval state machine for menu/event displays.
 * Spec: docs/superpowers/specs/2026-09-01-vercel-efficiency-design.md
 */
import { describe, expect, it } from 'vitest'
import {
  ERROR_BACKOFF_CAP_MS,
  FAST_INTERVAL_MS,
  IDLE_INTERVAL_MS,
  selectPollInterval,
} from '@/lib/hooks/poll-interval'

describe('selectPollInterval', () => {
  it('returns null when the tab is hidden', () => {
    expect(
      selectPollInterval({
        noChangeCount: 0,
        warm: true,
        consecutiveErrors: 0,
        hidden: true,
      }),
    ).toBeNull()
  })

  it('uses the fast interval on the first successful poll', () => {
    expect(
      selectPollInterval({
        noChangeCount: 1,
        warm: false,
        consecutiveErrors: 0,
        hidden: false,
        isInitial: true,
      }),
    ).toBe(FAST_INTERVAL_MS)
  })

  it('uses the fast interval while content is warm', () => {
    expect(
      selectPollInterval({
        noChangeCount: 40,
        warm: true,
        consecutiveErrors: 0,
        hidden: false,
      }),
    ).toBe(FAST_INTERVAL_MS)
  })

  it('uses the fast interval when noChangeCount is 0', () => {
    expect(
      selectPollInterval({
        noChangeCount: 0,
        warm: false,
        consecutiveErrors: 0,
        hidden: false,
      }),
    ).toBe(FAST_INTERVAL_MS)
  })

  it('settles at 30s once content is unchanged and not warm', () => {
    expect(
      selectPollInterval({
        noChangeCount: 1,
        warm: false,
        consecutiveErrors: 0,
        hidden: false,
      }),
    ).toBe(IDLE_INTERVAL_MS)
    expect(
      selectPollInterval({
        noChangeCount: 90,
        warm: false,
        consecutiveErrors: 0,
        hidden: false,
      }),
    ).toBe(IDLE_INTERVAL_MS)
  })

  it('backs off on consecutive errors and caps at 120s', () => {
    const base = {
      noChangeCount: 0,
      warm: true,
      hidden: false,
    }
    expect(selectPollInterval({ ...base, consecutiveErrors: 1 })).toBe(30_000)
    expect(selectPollInterval({ ...base, consecutiveErrors: 2 })).toBe(60_000)
    expect(selectPollInterval({ ...base, consecutiveErrors: 3 })).toBe(ERROR_BACKOFF_CAP_MS)
    expect(selectPollInterval({ ...base, consecutiveErrors: 8 })).toBe(ERROR_BACKOFF_CAP_MS)
  })

  it('lets hidden win over errors and warm', () => {
    expect(
      selectPollInterval({
        noChangeCount: 0,
        warm: true,
        consecutiveErrors: 3,
        hidden: true,
      }),
    ).toBeNull()
  })

  it('lets errors win over warm', () => {
    expect(
      selectPollInterval({
        noChangeCount: 0,
        warm: true,
        consecutiveErrors: 1,
        hidden: false,
      }),
    ).toBe(30_000)
  })
})
