/**
 * GET /events/<id>/calendar.ics serves one upcoming public event as a
 * text/calendar download, and 404s (uncached) for anything not public.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/utils/payload-api', () => ({
  getPublicEventById: vi.fn(async (id: string) =>
    id !== 'abc123'
      ? null
      : {
          id: 'abc123',
          organizer: 'Trivia',
          description: 'Staff: tab under Smith',
          date: '2026-10-14T12:00:00.000Z',
          startTime: '7pm',
          endTime: '9pm',
          location: {
            slug: 'lawrenceville',
            name: 'Lawrenceville',
            address: {
              street: '5247 Butler Street',
              city: 'Pittsburgh',
              state: 'PA',
              zip: '15201',
            },
          },
        },
  ),
}))

import { GET } from '@/src/app/(frontend)/events/[id]/calendar.ics/route'

const call = (id: string) =>
  GET(new Request(`https://lolev.beer/events/${id}/calendar.ics`) as never, {
    params: Promise.resolve({ id }),
  })

describe('event calendar.ics route', () => {
  it('returns a text/calendar attachment for a public event', async () => {
    const res = await call('abc123')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/calendar; charset=utf-8')
    expect(res.headers.get('content-disposition')).toContain('filename="trivia.ics"')
    const body = await res.text()
    expect(body).toContain('DTSTART;TZID=America/New_York:20261014T190000')
    expect(body.replace(/\r\n /g, '')).toContain(
      'LOCATION:Lolev Beer - Lawrenceville\\, 5247 Butler Street',
    )
    expect(body).not.toContain('Smith')
  })

  it('404s for an unknown or non-public event', async () => {
    const res = await call('nope')
    expect(res.status).toBe(404)
    // Never cache a miss: the id may become public moments later.
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})
