/**
 * Pure helpers behind the admin stock-vs-target widget: time-weighted
 * on-target share and the over/under-agnostic severity buckets.
 */
import { describe, expect, it } from 'vitest'

import { severity, stockedCount, stockTimeline } from '@/lib/utils/menu-target'

const h = (n: number) => `2026-10-01T${String(n).padStart(2, '0')}:00:00.000Z`

describe('stockTimeline', () => {
  it('weights each revision by how long it was live, against its own target', () => {
    const { segments, onTargetShare } = stockTimeline(
      [
        { updatedAt: h(0), items: 10, target: null }, // default 10: on target for 1h
        { updatedAt: h(1), items: 13, target: 10 }, // 3 over for 2h
        { updatedAt: h(3), items: 8, target: 8 }, // on target until end, 1h
      ],
      Date.parse(h(4)),
    )
    expect(segments.map((s) => s.diff)).toEqual([0, 3, 0])
    expect(onTargetShare).toBe(0.5)
  })

  it('handles no revisions', () => {
    expect(stockTimeline([], Date.parse(h(1))).onTargetShare).toBe(0)
  })
})

describe('stockedCount', () => {
  it('skips rows with no product, which the public menu hides', () => {
    expect(stockedCount([{ product: 'a' }, { product: null }, { product: 'b' }])).toBe(2)
    expect(stockedCount(undefined)).toBe(0)
  })
})

describe('severity', () => {
  it('treats over and under alike', () => {
    expect([0, 1, -2, 3, -5].map(severity)).toEqual(['ok', 'near', 'near', 'far', 'far'])
  })
})
