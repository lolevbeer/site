import { describe, it, expect } from 'vitest'
import { formatHoursTime, getDayName, formatTime, formatOpenHours } from '@/lib/utils/formatters'
import {
  clockFromPickedTime,
  clockFromStoredTime,
  pickerTimeFromClock,
  storedTimeFromClock,
} from '@/lib/utils/date'

// The behaviour the four removed copies had, pinned so consolidation can't drift it.
describe('formatHoursTime', () => {
  it('formats HH:mm on the hour', () => expect(formatHoursTime('11:00')).toBe('11 AM'))
  it('formats HH:mm with minutes', () => expect(formatHoursTime('21:30')).toBe('9:30 PM'))
  it('handles midnight and noon', () => {
    expect(formatHoursTime('00:00')).toBe('12 AM')
    expect(formatHoursTime('12:00')).toBe('12 PM')
  })
  it('returns empty for null', () => expect(formatHoursTime(null)).toBe(''))
  it('formats an ISO instant in the given zone', () =>
    expect(formatHoursTime('2000-01-01T16:00:00.000Z', 'America/New_York')).toBe('11 AM'))
})

describe('getDayName', () => {
  it('capitalises each day key', () => {
    expect(getDayName('monday')).toBe('Monday')
    expect(getDayName('wednesday')).toBe('Wednesday')
    expect(getDayName('sunday')).toBe('Sunday')
  })
})

describe('formatTime stays the prose variant', () => {
  it('is lowercase and drops :00', () => expect(formatTime('19:00')).toBe('7pm'))
  it('keeps minutes', () => expect(formatTime('19:30')).toBe('7:30pm'))
})

it.each([
  ['7pm', '7pm'],
  ['12am', '12am'],
  ['12pm', '12pm'],
  ['7:30pm', '7:30pm'],
])('preserves the meridiem in %s', (input, expected) => expect(formatTime(input)).toBe(expected))

describe('formatOpenHours', () => {
  it('writes a day as the Google hours check compares it', () => {
    const day = { open: '2000-01-01T21:00:00.000Z', close: '2000-01-02T03:00:00.000Z' }
    expect(formatOpenHours(day, 'America/New_York')).toBe('4pm–10pm')
    expect(formatOpenHours(day, 'America/Chicago')).toBe('3pm–9pm')
  })

  it('reads a day without both times as closed', () => {
    expect(formatOpenHours(undefined)).toBe('Closed')
    expect(formatOpenHours({ open: '2000-01-01T21:00:00.000Z', close: null })).toBe('Closed')
  })
})

describe('weekly hours as the admin table edits them', () => {
  it("reads a stored opening time as the clock time in the taproom's zone", () => {
    expect(clockFromStoredTime('2000-01-01T21:00:00.000Z', 'America/New_York')).toBe('16:00')
    expect(clockFromStoredTime('2000-01-01T05:00:00.000Z', 'America/New_York')).toBe('00:00')
    expect(clockFromStoredTime(null, 'America/New_York')).toBe('')
  })

  it('stores a clock time on the reference day the existing hours use', () => {
    expect(storedTimeFromClock('16:00', 'America/New_York')).toBe('2000-01-01T21:00:00.000Z')
    expect(storedTimeFromClock('22:30', 'America/Chicago')).toBe('2000-01-02T04:30:00.000Z')
    expect(storedTimeFromClock('', 'America/New_York')).toBeNull()
  })

  it("hands Payload's time picker the clock time, whatever the browser's zone", () => {
    // The picker shows and returns times in the browser's zone; only hours and minutes matter.
    const picked = pickerTimeFromClock('17:30')!
    expect([picked.getHours(), picked.getMinutes()]).toEqual([17, 30])
    expect(clockFromPickedTime(picked)).toBe('17:30')
    expect(pickerTimeFromClock('')).toBeUndefined()
    expect(clockFromPickedTime(null)).toBe('')
  })

  it('round-trips, so the public hours read the same after an edit', () => {
    const stored = storedTimeFromClock('17:00', 'America/New_York')!
    expect(formatOpenHours({ open: stored, close: stored }, 'America/New_York')).toBe('5pm–5pm')
  })
})
