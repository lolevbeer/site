/**
 * Per-event .ics: local wall times under TZID America/New_York (so calendars
 * get DST right on either side of the switch), DTEND rolls past midnight,
 * TBD times become all-day, and the internal CMS description never ships.
 */
import { describe, expect, it } from 'vitest'
import { buildEventIcs } from '@/lib/utils/event-ics'

/** Undo RFC 5545 line folding. */
function unfold(ics: string): string {
  return ics.replace(/\r\n /g, '')
}

/**
 * Resolve a DTSTART/DTEND to UTC using only the file's own VTIMEZONE rules
 * (yearly BYMONTH + nSU transitions), the way a calendar client would.
 */
function instant(ics: string, prop: 'DTSTART' | 'DTEND'): string {
  const text = unfold(ics)
  const wall = text.match(new RegExp(`^${prop};TZID=[^:]+:(\\d{8})T(\\d{6})$`, 'm'))!
  const [y, mo, d] = [wall[1].slice(0, 4), wall[1].slice(4, 6), wall[1].slice(6, 8)].map(Number)
  const [h, mi] = [wall[2].slice(0, 2), wall[2].slice(2, 4)].map(Number)
  const wallMs = Date.UTC(y, mo - 1, d, h, mi)

  const rules = ['DAYLIGHT', 'STANDARD'].map((kind) => {
    const block = text.match(new RegExp(`BEGIN:${kind}([\\s\\S]*?)END:${kind}`))![1]
    const offset = block.match(/TZOFFSETTO:([+-])(\d{2})(\d{2})/)!
    const offsetMin = (offset[1] === '-' ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3]))
    const rrule = block.match(/BYMONTH=(\d+);BYDAY=(\d)SU/)!
    const at = block.match(/DTSTART:\d{8}T(\d{2})/)!
    const month = Number(rrule[1]) - 1
    const firstSunday = 1 + ((7 - new Date(Date.UTC(y, month, 1)).getUTCDay()) % 7)
    const day = firstSunday + 7 * (Number(rrule[2]) - 1)
    return { offsetMin, start: Date.UTC(y, month, day, Number(at[1])) }
  })
  // Pick the rule whose transition most recently passed (wrapping to last year's).
  const passed = rules.filter((rule) => rule.start <= wallMs)
  const active = passed.length
    ? passed.reduce((a, b) => (a.start > b.start ? a : b))
    : rules.reduce((a, b) => (a.start > b.start ? a : b))
  return new Date(wallMs - active.offsetMin * 60_000).toISOString()
}

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
    expect(unfold(ics)).toContain('LOCATION:Lolev Beer - Lawrenceville\\, 5247 Butler Street\\, Pittsburgh\\, PA 15201')
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

  it('resolves to the right UTC instants across the November fall-back', () => {
    // 2026-11-01 is the fall-back date: 10pm Oct 31 is EDT, 2am Nov 1 is EST.
    const ics = buildEventIcs(
      { ...base, date: '2026-10-31', startTime: '22:00', endTime: '02:00' },
      stamp,
    )
    expect(instant(ics, 'DTSTART')).toBe('2026-11-01T02:00:00.000Z')
    expect(instant(ics, 'DTEND')).toBe('2026-11-01T07:00:00.000Z')
  })

  it('resolves to the right UTC instants across the March spring-forward', () => {
    // 2027-03-14 is the second Sunday of March: the night before is still EST.
    const before = buildEventIcs({ ...base, date: '2027-03-13', startTime: '8pm' }, stamp)
    expect(instant(before, 'DTSTART')).toBe('2027-03-14T01:00:00.000Z')
    const after = buildEventIcs({ ...base, date: '2027-03-14', startTime: '8pm' }, stamp)
    expect(instant(after, 'DTSTART')).toBe('2027-03-15T00:00:00.000Z')
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

  it('drops a non-http site and cannot be injected through a newline in it', () => {
    const injected = buildEventIcs(
      { ...base, startTime: '7pm', site: 'https://tix.example.com/x\r\nDESCRIPTION:pwned' },
      stamp,
    )
    expect(injected).not.toMatch(/^DESCRIPTION/m)
    const bogus = buildEventIcs({ ...base, startTime: '7pm', site: 'javascript:alert(1)' }, stamp)
    expect(bogus).toContain('URL:https://lolev.beer/events?loc=lawrenceville#event-abc123')
  })

  it('folds lines longer than 75 octets and escapes bare carriage returns', () => {
    const title = `Ünïcode ${'very long event title '.repeat(8)}\rend`
    const ics = buildEventIcs({ ...base, organizer: title, startTime: '7pm' }, stamp)
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
    expect(ics.replace(/\r\n/g, '\n')).not.toContain('\r')
    expect(unfold(ics)).toContain(`SUMMARY:${title.replace('\r', '\\n')}`)
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
