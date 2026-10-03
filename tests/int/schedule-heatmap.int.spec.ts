import { describe, expect, it } from 'vitest'

import { buildHeatmapWeeks, monthSpans, slotDatesInRange } from '@/lib/utils/schedule-heatmap'

describe('buildHeatmapWeeks', () => {
  it('lays out Sunday-first week columns of dates', () => {
    const weeks = buildHeatmapWeeks('2026-09-20', 2)
    expect(weeks).toHaveLength(2)
    expect(weeks[0][0]).toBe('2026-09-20')
    expect(weeks[1][6]).toBe('2026-10-03')
  })
})

describe('slotDatesInRange', () => {
  it('keeps a slot inside its own year, even when the range runs past it', () => {
    // 2nd Tuesday (dayIndex 2, occurrence 2), range Nov 2026 – Feb 2027.
    expect(slotDatesInRange(2, 2, 2026, '2026-11-01', '2027-02-28')).toEqual([
      '2026-11-10',
      '2026-12-08',
    ])
    expect(slotDatesInRange(2, 2, 2027, '2026-11-01', '2027-02-28')).toEqual([
      '2027-01-12',
      '2027-02-09',
    ])
  })

  it('clips to the range and skips months without a fifth occurrence', () => {
    // 5th Friday in 2026: Oct 30 exists, Nov has none, Dec 25 is outside the range.
    expect(slotDatesInRange(5, 5, 2026, '2026-10-05', '2026-12-20')).toEqual(['2026-10-30'])
  })
})

describe('monthSpans', () => {
  it('groups week columns by the month their Saturday falls in', () => {
    const weeks = buildHeatmapWeeks('2026-09-20', 6)
    // Columns end Sep 26, Oct 3, 10, 17, 24, 31.
    expect(monthSpans(weeks)).toEqual([
      { label: 'Sep', span: 1 },
      { label: 'Oct', span: 5 },
    ])
  })
})
