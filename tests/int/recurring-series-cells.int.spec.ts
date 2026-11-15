import { describe, expect, it } from 'vitest'
import type { Location } from '@/src/payload-types'
import {
  recurringPatternLabel,
  recurringSeriesCells,
  type RecurringSeries,
} from '@/src/components/admin/recurring-series-cells'
import { recurringOccurrences } from '@/src/utils/recurring-food'

const DATE_FORMAT = 'MMM d, yyyy'

const series: RecurringSeries = {
  id: 'trivia',
  active: true,
  visibility: 'public',
  organizer: 'Trivia Night',
  year: 2027,
  day: 'wednesday',
  occurrences: ['first', 'third'],
  location: 'lawrenceville',
  createdAt: '2026-08-29T16:00:00.000Z',
  updatedAt: '2026-08-30T16:00:00.000Z',
}

describe('recurring pattern label', () => {
  it('names the chosen occurrences in calendar order', () => {
    expect(recurringPatternLabel('wednesday', ['third', 'first'])).toBe('First & Third Wednesday')
  })

  it('says "Every" when all five occurrences are chosen', () => {
    expect(recurringPatternLabel('saturday', [...recurringOccurrences])).toBe('Every Saturday')
  })
})

describe('recurring series cells', () => {
  it('fills the dated-events columns, with the pattern and year in the date column', () => {
    const cells = recurringSeriesCells(
      {
        ...series,
        startTime: '2026-01-01T00:00:00.000Z',
        tags: ['puzzle'],
        location: { id: 'lawrenceville', name: 'Lolev Lawrenceville' } as Location,
      },
      DATE_FORMAT,
    )

    expect(cells).toMatchObject({
      id: 'trivia',
      organizer: 'Trivia Night',
      date: 'First & Third Wednesday · 2027',
      startTime: '7:00 PM',
      endTime: '',
      location: 'Lolev Lawrenceville',
      visibility: 'Public',
      tags: 'Games',
      updatedAt: 'Aug 30, 2026',
    })
  })

  it('leaves the taproom blank when the location is a bare ID or missing', () => {
    expect(recurringSeriesCells(series, DATE_FORMAT).location).toBe('')
    const broken = { ...series, location: null } as unknown as RecurringSeries
    expect(recurringSeriesCells(broken, DATE_FORMAT).location).toBe('')
  })

  it('treats a legacy series with no year as the 2026 season', () => {
    const legacy = { ...series, year: undefined } as unknown as RecurringSeries
    expect(recurringSeriesCells(legacy, DATE_FORMAT).date).toBe('First & Third Wednesday · 2026')
  })
})
