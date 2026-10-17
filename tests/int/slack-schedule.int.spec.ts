/**
 * `/lolevbeer events` data and the shared schedule message: the Pittsburgh
 * window, recurring merge, EST day labels, and time-of-day ordering.
 */
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

  it('orders same-day entries by Pittsburgh time of day, not by the stored string', () => {
    const message = buildScheduleMessage(
      'events',
      [
        // 7:30pm EST, saved on a different reference date.
        {
          date: '2026-11-06',
          title: 'Later',
          location: 'L',
          startTime: '2025-11-02T00:30:00.000Z',
        },
        // 7pm EDT.
        {
          date: '2026-11-06',
          title: 'Earlier',
          location: 'L',
          startTime: '2026-03-01T23:00:00.000Z',
        },
      ],
      '2026-11-06',
      '2026-11-19',
    )
    const text = String(message.text)
    expect(text.indexOf('Earlier')).toBeLessThan(text.indexOf('Later'))
  })

  it('labels an evening event by its Pittsburgh day and queries EST day bounds', async () => {
    const find = vi.fn(async ({ collection }: { collection: string }) => ({
      docs:
        collection === 'events'
          ? [
              {
                id: 'late',
                organizer: 'Late show',
                date: '2026-10-30T02:00:00Z',
                location,
              } as Event,
            ]
          : [],
    }))
    const entries = await findUpcomingSlackEvents(
      { find } as unknown as Payload,
      user,
      '2026-10-29',
      '2026-10-29',
    )
    expect(entries).toEqual([expect.objectContaining({ date: '2026-10-29', title: 'Late show' })])
    expect(find.mock.calls[0][0]).toMatchObject({
      where: {
        and: [
          { date: { greater_than_equal: '2026-10-29T04:00:00.000Z' } },
          { date: { less_than: '2026-10-30T04:00:00.000Z' } },
        ],
      },
    })
  })
})
