import { describe, expect, it, vi } from 'vitest'
import { getDatesForSlotInYear, getUpcomingDatesForSlot, toDateKey } from '@/lib/utils/food-dates'

describe('year-scoped recurring dates', () => {
  it('expands a slot only within the selected calendar year', () => {
    const dates = getDatesForSlotInYear(1, 1, 2027)

    expect(dates.map((date) => date.toISOString().slice(0, 10))).toEqual([
      '2027-01-04',
      '2027-02-01',
      '2027-03-01',
      '2027-04-05',
      '2027-05-03',
      '2027-06-07',
      '2027-07-05',
      '2027-08-02',
      '2027-09-06',
      '2027-10-04',
      '2027-11-01',
      '2027-12-06',
    ])
  })

  it('omits months that do not contain the selected occurrence', () => {
    const dates = getDatesForSlotInYear(1, 5, 2027)

    expect(dates.map((date) => date.toISOString().slice(0, 10))).toEqual([
      '2027-03-29',
      '2027-05-31',
      '2027-08-30',
      '2027-11-29',
    ])
  })
})

it('keeps the Pittsburgh calendar day through UTC month and year boundaries', () => {
  vi.useFakeTimers()
  try {
    vi.setSystemTime(new Date('2026-10-01T01:00:00Z'))
    expect(getUpcomingDatesForSlot(3, 5, 3).map(toDateKey)).toContain('2026-09-30')
    vi.setSystemTime(new Date('2027-01-01T02:00:00Z'))
    expect(getUpcomingDatesForSlot(4, 5, 3).map(toDateKey)).toContain('2026-12-31')
  } finally {
    vi.useRealTimers()
  }
})
