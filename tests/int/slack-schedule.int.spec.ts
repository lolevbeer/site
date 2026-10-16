import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import type { Event, RecurringEvent, User } from '@/src/payload-types'
import { findUpcomingSlackEvents } from '@/lib/slack/upcoming-events'
import { buildScheduleMessage, slackScheduleWindow } from '@/lib/slack/schedule'

const user = { id: 'bartender', roles: ['bartender'] } as User
const location = { id: 'loc', name: 'Lawrenceville' }

describe('Slack upcoming schedules', () => {
  it('uses the Pittsburgh calendar even when UTC is already tomorrow', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-12-31T02:00:00Z'))
      expect(slackScheduleWindow()).toEqual({ from: '2026-12-30', through: '2027-01-12' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('merges recurring events with one-off overrides and skips excluded or unreadable occurrences', async () => {
    const definition = {
      id: 'weekly',
      organizer: 'Trivia',
      active: true,
      year: 2026,
      day: 'friday',
      occurrences: ['first', 'second', 'third'],
      location,
      visibility: 'private',
      excludedDates: [{ date: '2026-10-09T12:00:00Z' }],
    } as RecurringEvent
    const override = {
      id: 'special',
      organizer: 'Trivia',
      date: '2026-10-02T12:00:00Z',
      location,
      visibility: 'private',
      startTime: '19:00',
    } as Event
    const payload = {
      find: vi.fn(async ({ collection }) => ({
        docs:
          collection === 'events'
            ? [override]
            : [definition, { ...definition, id: 'hidden', location: 'denied' }],
      })),
    } as unknown as Payload
    const entries = await findUpcomingSlackEvents(payload, user, '2026-10-01', '2026-10-14')
    expect(entries).toEqual([
      {
        date: '2026-10-02',
        title: 'Trivia',
        location: 'Lawrenceville',
        private: true,
        startTime: '19:00',
        endTime: undefined,
      },
    ])
  })

  it('marks private entries, escapes Slack mentions, and reports truncated schedules', () => {
    const entries = Array.from({ length: 21 }, (_, i) => ({
      date: '2026-10-16',
      title: i === 0 ? '<!channel> Party' : `Event ${i}`,
      location: 'Lawrenceville',
      private: true,
      startTime: '18:00',
      endTime: '20:00',
    }))
    const message = buildScheduleMessage('events', entries, '2026-10-16', '2026-10-29')
    expect(message.response_type).toBe('ephemeral')
    expect(message.text).toContain('&lt;!channel&gt; Party')
    expect(message.text).toContain('6pm–8pm')
    expect(message.text).toContain('(Private)')
    expect(message.text).toContain('first 20 of 21')
    expect(message.text).not.toContain('Event 20 ·')
  })
})
