import { describe, it, expect } from 'vitest'
import { formatHoursTime, getDayName, formatTime } from '@/lib/utils/formatters'

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
