/**
 * Menu/event stream timestamp, warm flag, and shared CDN cache policy.
 */
import { describe, expect, it } from 'vitest'
import {
  STREAM_CACHE_CONTROL,
  WARM_WINDOW_MS,
  contentTimestampFromEvents,
  contentTimestampFromMenu,
  isWarm,
} from '@/lib/utils/stream-freshness'

describe('STREAM_CACHE_CONTROL', () => {
  it('aligns the shared CDN object with the 30s idle poll', () => {
    expect(STREAM_CACHE_CONTROL).toBe(
      'public, max-age=0, s-maxage=30, stale-while-revalidate=60',
    )
  })
})

describe('contentTimestampFromMenu', () => {
  it('uses the menu updatedAt when items are older or missing', () => {
    expect(
      contentTimestampFromMenu({
        updatedAt: '2026-09-01T12:00:00.000Z',
        items: [{ product: { value: { updatedAt: '2026-09-01T11:00:00.000Z' } } }],
      }),
    ).toBe(Date.parse('2026-09-01T12:00:00.000Z'))
  })

  it('lets a populated item timestamp supersede the menu timestamp', () => {
    expect(
      contentTimestampFromMenu({
        updatedAt: '2026-09-01T12:00:00.000Z',
        items: [{ product: { value: { updatedAt: '2026-09-01T12:05:00.000Z' } } }],
      }),
    ).toBe(Date.parse('2026-09-01T12:05:00.000Z'))
  })
})

describe('contentTimestampFromEvents', () => {
  it('uses the latest event updatedAt', () => {
    expect(
      contentTimestampFromEvents([
        { updatedAt: '2026-09-01T10:00:00.000Z' },
        { updatedAt: '2026-09-01T12:00:00.000Z' },
      ]),
    ).toBe(Date.parse('2026-09-01T12:00:00.000Z'))
  })

  it('stays at 0 for an empty list so warm does not spoof editor activity', () => {
    expect(contentTimestampFromEvents([])).toBe(0)
    expect(isWarm(0, Date.parse('2026-09-01T12:00:00.000Z'))).toBe(false)
  })
})

describe('isWarm', () => {
  const now = Date.parse('2026-09-01T12:00:00.000Z')

  it('is true when content changed inside the warm window', () => {
    expect(isWarm(now - 30_000, now)).toBe(true)
    expect(isWarm(now - (WARM_WINDOW_MS - 1), now)).toBe(true)
  })

  it('is false when content is older than the warm window', () => {
    expect(isWarm(now - WARM_WINDOW_MS, now)).toBe(false)
    expect(isWarm(now - WARM_WINDOW_MS - 1, now)).toBe(false)
  })
})
