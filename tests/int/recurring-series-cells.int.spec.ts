/**
 * The "Recurring series" block above the Events list: the text each series
 * shows in that list's columns, the rows the block is built from, and the
 * Payload list markup its column alignment reads.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { Location, Media } from '@/src/payload-types'
import {
  recurringPatternLabel,
  recurringSeriesCells,
  recurringSeriesRows,
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

  it('fills the booking and image columns when the series has them', () => {
    const cells = recurringSeriesCells(
      {
        ...series,
        attendees: 40,
        pointOfContact: 'Sam Host',
        email: 'sam@example.com',
        phone: '412-555-0100',
        otherInfo: 'Needs the back room',
        image: { id: 'm-1', filename: 'trivia.jpg' } as Media,
      },
      DATE_FORMAT,
    )

    expect(cells).toMatchObject({
      attendees: '40',
      pointOfContact: 'Sam Host',
      email: 'sam@example.com',
      phone: '412-555-0100',
      otherInfo: 'Needs the back room',
      image: 'trivia.jpg',
    })
    // Unset, or hidden from this viewer by field access: blank, never "undefined".
    expect(recurringSeriesCells(series, DATE_FORMAT)).toMatchObject({ attendees: '', image: '' })
  })
})

describe('recurring series rows', () => {
  const options = {
    listURL: '/admin/collections/recurring-events',
    dateFormat: DATE_FORMAT,
    columns: ['_select', 'organizer', 'date'],
    onError: () => {},
  }

  it('links each row to its series and marks inactive ones paused', () => {
    const [row] = recurringSeriesRows([{ ...series, active: false }], options)

    expect(row).toMatchObject({
      id: 'trivia',
      href: '/admin/collections/recurring-events/trivia',
      paused: true,
    })
  })

  it('sends only the visible columns, with the name as the row title', () => {
    const [row] = recurringSeriesRows([{ ...series, description: 'Long staff notes' }], {
      ...options,
      columns: ['_select', 'date'],
    })

    expect(row.cells).toEqual({ _select: '', date: 'First & Third Wednesday · 2027' })
    expect(row.title).toBe('Trivia Night')
  })

  it('orders by season then name, with year-less legacy series among the 2026 ones', () => {
    const named = (id: string, organizer: string, year?: number) =>
      ({ ...series, id, organizer, year }) as RecurringSeries
    const rows = recurringSeriesRows(
      [
        named('legacy-b', 'Bingo'),
        named('legacy-z', 'Zumba'),
        named('2026-k', 'Karaoke', 2026),
        named('2027-a', 'Art Night', 2027),
      ],
      options,
    )

    expect(rows.map((row) => row.id)).toEqual(['legacy-b', '2026-k', 'legacy-z', '2027-a'])
  })

  it('leaves out a series it cannot format and reports it, keeping the rest', () => {
    const onError = vi.fn()
    const broken = { ...series, id: 'broken', startTime: 'not a time' }

    const rows = recurringSeriesRows([broken, series], { ...options, onError })

    expect(rows.map((row) => row.id)).toEqual(['trivia'])
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'broken')
  })
})

// RecurringSeriesTable copies the Events table's columns by reading this markup.
// If a Payload upgrade renames it, the two tables silently stop lining up.
describe('Payload list markup the block depends on', () => {
  const ui = 'node_modules/@payloadcms/ui/dist'

  it('still marks header cells with data-column inside .collection-list', () => {
    expect(readFileSync(`${ui}/elements/Table/index.js`, 'utf8')).toContain('data-column')
    expect(readFileSync(`${ui}/views/List/index.client.js`, 'utf8')).toContain('collection-list')
  })
})
