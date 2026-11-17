/**
 * Pure helpers behind the admin schedule heatmap widget: grid layout,
 * per-year recurring slot projection, month header spans, booking dedupe,
 * the window length, the "Tonight:" summary, day hover text, the open
 * nights without food count, and closed weekdays from opening hours.
 */
import { describe, expect, it } from 'vitest'

import { closedWeekdays } from '@/lib/config/locations'
import { WEEKDAYS, type PayloadLocation, type Weekday } from '@/lib/types/location'
import {
  buildHeatmapWeeks,
  dayLabel,
  dedupeSchedule,
  formatDay,
  groupByDay,
  monthSpans,
  openNightsWithoutFood,
  slotDatesInRange,
  tonightSummary,
  WEEKS,
  type ScheduleRow,
} from '@/lib/utils/schedule-heatmap'

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

describe('dedupeSchedule', () => {
  const food = (name: string, vendor: string, recurring?: true): ScheduleRow => ({
    day: '2026-10-10',
    kind: 'food',
    name,
    location: 'loc-1',
    vendor,
    ...(recurring && { recurring }),
  })

  it('collapses a one-off that confirms a recurring slot by vendor id, keeping the one-off', () => {
    // Vendor renamed after the one-off was saved: names differ, id matches.
    const rows = dedupeSchedule([food('Old Name', 'v1'), food('New Name', 'v1', true)])
    expect(rows).toEqual([food('Old Name', 'v1')])
  })

  it('keeps two different vendors that share a name on the same day', () => {
    expect(dedupeSchedule([food('Tacos', 'v1'), food('Tacos', 'v2')])).toHaveLength(2)
  })

  it('matches events on location + day + organizer, case-insensitively', () => {
    const event = (name: string): ScheduleRow => ({
      day: '2026-10-10',
      kind: 'event',
      name,
      location: 'loc-1',
    })
    expect(dedupeSchedule([event('Trivia'), event(' trivia ')])).toHaveLength(1)
  })
})

describe('WEEKS', () => {
  it('shows about six months per window', () => {
    expect(WEEKS).toBe(26)
  })
})

const row = (kind: ScheduleRow['kind'], name: string, day = '2026-10-31'): ScheduleRow => ({
  day,
  kind,
  name,
  location: 'loc-1',
})

describe('tonightSummary', () => {
  // 2026-10-31 is a Saturday (weekday 6).
  const summary = (rows: ScheduleRow[], closedDays: number[] = []) =>
    tonightSummary(groupByDay(rows), '2026-10-31', closedDays)

  it('says nothing is booked and names the next booking', () => {
    expect(
      summary([row('event', 'Trivia', '2026-11-01'), row('food', 'Tacos', '2026-11-02')]),
    ).toBe('Tonight: nothing booked. Next: Sun, Nov 1 · Trivia')
  })

  it('says closed on a weekday with no opening hours, and stops when nothing is ahead', () => {
    expect(summary([row('event', 'Bingo', '2026-10-30')], [6])).toBe('Tonight: closed')
  })

  it('names the one booking, trimmed', () => {
    expect(summary([row('food', ' Taco Truck ')])).toBe('Tonight: Taco Truck')
  })

  it('flags an event with no food booked', () => {
    expect(summary([row('event', 'Trivia')])).toBe('Tonight: Trivia · no food booked')
  })

  it('lists events before food, skipping other days', () => {
    const rows = [
      row('food', 'Taco Truck'),
      row('event', 'Trivia'),
      row('event', 'Bingo', '2026-10-30'),
      row('event', ''),
    ]
    expect(summary(rows)).toBe('Tonight: Trivia · Untitled · Taco Truck')
  })
})

describe('formatDay', () => {
  it('reads as weekday, month and day', () => {
    expect(formatDay('2026-11-20', '2026-11-17')).toBe('Fri, Nov 20')
  })

  it("adds the year when it is not today's", () => {
    expect(formatDay('2027-01-07', '2026-11-17')).toBe('Thu, Jan 7, 2027')
  })
})

describe('dayLabel', () => {
  const today = '2026-11-17'
  const day = (rows: ScheduleRow[], date: string) => groupByDay(rows).get(date)

  it('names events and food', () => {
    const rows = [row('event', 'Trivia', '2026-11-20'), row('food', 'El Rincon', '2026-11-20')]
    expect(dayLabel('2026-11-20', day(rows, '2026-11-20'), false, today)).toBe(
      'Fri, Nov 20 · Event: Trivia · Food: El Rincon',
    )
  })

  it('calls out an event with no food, even on a closed day', () => {
    const rows = [row('event', 'Private party', '2026-11-23')]
    expect(dayLabel('2026-11-23', day(rows, '2026-11-23'), true, today)).toBe(
      'Mon, Nov 23 · Event: Private party · No food booked',
    )
  })

  it('tells an open, empty day from a closed one', () => {
    expect(dayLabel('2026-11-18', undefined, false, today)).toBe('Wed, Nov 18 · No food booked')
    expect(dayLabel('2026-11-23', undefined, true, today)).toBe('Mon, Nov 23 · Closed')
  })
})

describe('openNightsWithoutFood', () => {
  it('counts open days from today on that have no food, skipping closed weekdays', () => {
    // Tue Nov 17 – Mon Nov 23, closed Mondays, food Fri and Sat: Tue, Wed, Thu, Sun are open gaps.
    const byDay = groupByDay([
      row('food', 'Tacos', '2026-11-20'),
      row('food', 'Pierogi', '2026-11-21'),
      row('event', 'Trivia', '2026-11-19'),
    ])
    expect(openNightsWithoutFood(byDay, '2026-11-17', [1], 7)).toBe(4)
  })

  it('looks four weeks ahead by default', () => {
    expect(openNightsWithoutFood(new Map(), '2026-11-17', [])).toBe(28)
  })
})

describe('closedWeekdays', () => {
  const hours = { open: '16:00', close: '22:00' }
  const location = (days: Partial<Record<Weekday, typeof hours>>) => days as PayloadLocation

  it('lists weekdays (0 = Sunday) with no opening hours', () => {
    const { monday: _closed, ...open } = Object.fromEntries(WEEKDAYS.map((d) => [d, hours]))
    expect(closedWeekdays(location(open))).toEqual([1])
  })

  it('treats a location with no hours set as open every day', () => {
    expect(closedWeekdays(location({}))).toEqual([])
  })
})
