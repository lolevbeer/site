import { describe, expect, it } from 'vitest'
import { getDatesForSlotInYear } from '@/lib/utils/food-dates'

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
