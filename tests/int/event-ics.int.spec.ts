/**
 * Per-event .ics: local wall times under TZID America/New_York (so calendars
 * get DST right on either side of the switch), DTEND rolls past midnight,
 * TBD times become all-day, and the internal CMS description never ships.
 */
import { describe, expect, it } from 'vitest'
import { buildEventIcs } from '@/lib/utils/event-ics'

const base = {
  id: 'abc123',
  organizer: 'Trivia',
  date: '2026-10-14T12:00:00.000Z',
  locationSlug: 'lawrenceville',
  locationName: 'Lawrenceville',
  address: '5247 Butler Street, Pittsburgh, PA 15201',
}

const stamp = new Date('2026-10-01T00:00:00Z')

describe('buildEventIcs', () => {
  it('emits a VEVENT with local start/end under the New York TZID', () => {
    const ics = buildEventIcs({ ...base, startTime: '7pm', endTime: '9pm' }, stamp)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('BEGIN:VTIMEZONE\r\nTZID:America/New_York')
    expect(ics).toContain('DTSTART;TZID=America/New_York:20261014T190000')
    expect(ics).toContain('DTEND;TZID=America/New_York:20261014T210000')
    expect(ics).toContain('SUMMARY:Trivia')
    expect(ics).toContain('UID:event-abc123@lolev.beer')
    expect(ics).toContain('URL:https://lolev.beer/events?loc=lawrenceville#event-abc123')
    expect(ics).toContain('LOCATION:Lolev Beer - Lawrenceville\\, 5247 Butler Street\\, Pittsburgh\\, PA 15201')
    expect(ics).toContain('DTSTAMP:20261001T000000Z')
  })

  it('rolls DTEND to the next day when the event runs past midnight', () => {
    const ics = buildEventIcs({ ...base, startTime: '9pm', endTime: '1am' }, stamp)
    expect(ics).toContain('DTSTART;TZID=America/New_York:20261014T210000')
    expect(ics).toContain('DTEND;TZID=America/New_York:20261015T010000')
  })

  it('rolls across a month end too', () => {
    const ics = buildEventIcs(
      { ...base, date: '2026-10-31', startTime: '10pm', endTime: '12:30am' },
      stamp,
    )
    expect(ics).toContain('DTEND;TZID=America/New_York:20261101T003000')
  })

  it('keeps wall time across the November DST change (night it falls back)', () => {
    // 2026-11-01 is the fall-back date: 10pm Oct 31 EDT to 1am Nov 1.
    const ics = buildEventIcs(
      { ...base, date: '2026-10-31', startTime: '22:00', endTime: '02:00' },
      stamp,
    )
    expect(ics).toContain('DTSTART;TZID=America/New_York:20261031T220000')
    expect(ics).toContain('DTEND;TZID=America/New_York:20261101T020000')
    // Both offsets are declared so clients resolve each side of the boundary.
    expect(ics).toContain('TZOFFSETTO:-0400')
    expect(ics).toContain('TZOFFSETTO:-0500')
  })

  it('becomes an all-day event when the time is missing or TBD', () => {
    for (const startTime of [undefined, 'TBD']) {
      const ics = buildEventIcs({ ...base, startTime }, stamp)
      expect(ics).toContain('DTSTART;VALUE=DATE:20261014')
      expect(ics).toContain('DTEND;VALUE=DATE:20261015')
    }
  })

  it('defaults a missing end to two hours after the start', () => {
    const ics = buildEventIcs({ ...base, startTime: '11pm' }, stamp)
    expect(ics).toContain('DTEND;TZID=America/New_York:20261015T010000')
  })

  it('prefers the event site for URL and escapes text', () => {
    const ics = buildEventIcs(
      { ...base, organizer: 'Bands; Beer, Fun', startTime: '7pm', site: 'https://tix.example.com/x' },
      stamp,
    )
    expect(ics).toContain('SUMMARY:Bands\\; Beer\\, Fun')
    expect(ics).toContain('URL:https://tix.example.com/x')
  })

  it('never includes a DESCRIPTION (the CMS description is internal)', () => {
    const ics = buildEventIcs(
      { ...base, startTime: '7pm', description: 'Staff: tab under Smith' } as Parameters<
        typeof buildEventIcs
      >[0],
      stamp,
    )
    expect(ics).not.toContain('DESCRIPTION')
    expect(ics).not.toContain('Smith')
  })
})
