import { describe, expect, it } from 'vitest'
import type { Event, RecurringEvent } from '@/src/payload-types'
import { expandRecurringEvents, mergeScheduledEvents } from '@/src/utils/recurring-events'

const definition: RecurringEvent = {
  id: 'trivia',
  active: true,
  visibility: 'public',
  organizer: 'Trivia Night',
  year: 2027,
  day: 'wednesday',
  occurrences: ['first', 'third'],
  location: 'lawrenceville',
  excludedDates: [{ date: '2027-02-03T12:00:00.000Z' }],
  createdAt: '2026-08-29T00:00:00.000Z',
  updatedAt: '2026-08-29T00:00:00.000Z',
}

describe('recurring event expansion', () => {
  it('expands selected monthly occurrences inside the window and honors exclusions', () => {
    const events = expandRecurringEvents([definition], '2027-01-01', '2027-02-28')

    expect(events.map((event) => event.date.slice(0, 10))).toEqual([
      '2027-01-06',
      '2027-01-20',
      '2027-02-17',
    ])
    expect(events.every((event) => event.organizer === 'Trivia Night')).toBe(true)
  })

  it('lets a matching one-off event override an expanded occurrence', () => {
    const recurring = expandRecurringEvents([definition], '2027-01-01', '2027-01-31')
    const oneOff: Event = {
      ...recurring[0],
      id: 'one-off',
      organizer: ' Trivia Night ',
      description: 'Special host',
    }

    const merged = mergeScheduledEvents([oneOff], recurring, 10)

    expect(merged).toHaveLength(2)
    expect(merged[0].id).toBe('one-off')
    expect(merged[0].description).toBe('Special host')
  })
})
