/**
 * Pure helpers behind the admin stock-vs-target widget: time-weighted
 * on-target share and the over/under-agnostic severity buckets.
 */
import { describe, expect, it } from 'vitest'

import { fillFor, stockedCount, stockTimeline, worstMiss } from '@/lib/utils/menu-target'

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
    expect(segments.map((s) => [s.items, s.target])).toEqual([
      [10, 10],
      [13, 10],
      [8, 8],
    ])
    expect(onTargetShare).toBe(0.5)
  })

  it('carries who saved each revision', () => {
    const { segments } = stockTimeline(
      [
        { updatedAt: h(0), items: 10, target: 10, editor: 'u1' },
        { updatedAt: h(1), items: 9, target: 10 },
      ],
      Date.parse(h(2)),
    )
    expect(segments.map((s) => s.editor)).toEqual(['u1', undefined])
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

describe('fillFor', () => {
  it('is green on target and colors over and under alike', () => {
    expect(fillFor(0)).toBe('var(--color-bg-success)')
    expect(fillFor(2)).toBe(fillFor(-2))
    expect(fillFor(1)).toContain('danger) 0%')
    expect(fillFor(9)).toContain('danger) 100%')
  })
})

describe('worstMiss', () => {
  it('ranks by distance from target, over or under alike', () => {
    expect(worstMiss([-1, 6, 0])).toBe(6)
    expect(worstMiss([-3, 2])).toBe(3)
    expect(worstMiss([])).toBe(-1)
  })
})
