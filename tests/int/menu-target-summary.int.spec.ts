/**
 * summarizeMenuTarget: one menu's stock timeline reduced to the figures a
 * dashboard card shows (today's count vs target, state, % on target, sparkline series).
 */
import { describe, expect, it } from 'vitest'

import { summarizeMenuTarget } from '@/lib/admin/menu-targets'
import { stockTimeline } from '@/lib/utils/menu-target'

const h = (n: number) => `2026-10-01T${String(n).padStart(2, '0')}:00:00.000Z`

function timeline(counts: number[], target = 10): ReturnType<typeof stockTimeline> {
  return stockTimeline(
    counts.map((items, i) => ({ updatedAt: h(i), items })),
    target,
    Date.parse(h(counts.length)),
  )
}

describe('summarizeMenuTarget', () => {
  it('is on target when the latest save matches', () => {
    expect(summarizeMenuTarget(timeline([12, 10]))).toMatchObject({
      count: 10,
      target: 10,
      diff: 0,
      state: 'on',
    })
  })

  it('is under with a negative diff', () => {
    expect(summarizeMenuTarget(timeline([10, 7]))).toMatchObject({
      count: 7,
      diff: -3,
      state: 'under',
    })
  })

  it('is over with a positive diff', () => {
    expect(summarizeMenuTarget(timeline([10, 12], 10))).toMatchObject({ diff: 2, state: 'over' })
  })

  it('reports % on target as the widget does: time-weighted, rounded to a whole percent', () => {
    // On target 1h of 3h.
    const t = timeline([10, 9, 11])
    expect(t.onTargetShare).toBeCloseTo(1 / 3)
    expect(summarizeMenuTarget(t)?.shareOnTarget).toBe(33)
  })

  it('lists item counts per save, oldest first', () => {
    expect(summarizeMenuTarget(timeline([8, 10, 13]))?.series).toEqual([8, 10, 13])
  })

  it('is null for a menu with no saves', () => {
    expect(summarizeMenuTarget(timeline([]))).toBeNull()
  })
})
