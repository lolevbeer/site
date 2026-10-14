/**
 * The /e/<location> TV board shows only ten agenda rows, so weekly regulars
 * (Trivia, Taco Tuesday) move to one compact "Regulars" strip and the
 * agenda keeps one-offs and food. A regular still appears on its own day when
 * that day is today, and the internal event description never renders.
 */
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventStatus, EventType, type BreweryEvent } from '@/lib/types/event'

const stream = vi.hoisted(() => ({ events: [] as BreweryEvent[] }))
vi.mock('@/lib/hooks/use-events-stream', () => ({
  useEventsStream: () => ({ events: stream.events, locationName: 'Lawrenceville', theme: 'light' }),
}))
vi.mock('@/components/home/featured-menu', () => ({ FeaturedCans: () => null }))

import { LiveEvents } from '@/components/events/live-events'

const ev = (id: string, title: string, date: string, time: string, recurring = true) =>
  ({
    id,
    title,
    vendor: title,
    date,
    time,
    type: recurring ? EventType.RECURRING : EventType.SPECIAL_EVENT,
    status: EventStatus.SCHEDULED,
    location: 'lolev-lawrenceville',
    description: 'Staff: tab under Smith',
  }) as BreweryEvent

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-13T16:00:00Z')) // Tue Oct 13, noon ET
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function renderBoard() {
  return render(
    <LiveEvents
      location="lolev-lawrenceville"
      initialEvents={[]}
      initialLocationName="Lawrenceville"
    />,
  )
}

describe('LiveEvents regulars', () => {
  it('collapses an every-other-week series with its cadence (Zelienople Bingo)', () => {
    stream.events = ['2026-10-19', '2026-11-02', '2026-11-16', '2026-11-30'].map((d, i) =>
      ev(`r-b${i}`, 'Bingo', d, '19:00'),
    )
    renderBoard()
    const strip = screen.getByRole('region', { name: 'Regulars' })
    expect(strip.textContent).toContain('Every other Mon 7pm')
    expect(strip.textContent).toContain('Bingo')
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0)
  })

  it('moves weekly regulars to the "Regulars" strip, keeping tonight on the agenda', () => {
    stream.events = [
      ev('r-t1', 'Taco Tuesday', '2026-10-13', '17:00'),
      ev('r-t2', 'Taco Tuesday', '2026-10-20', '17:00'),
      ev('r-t3', 'Taco Tuesday', '2026-10-27', '17:00'),
      ev('r-w1', 'Trivia', '2026-10-14', '19:00'),
      ev('r-w2', 'Trivia', '2026-10-21', '19:00'),
      ev('r-w3', 'Trivia', '2026-10-28', '19:00'),
      ev('one', '4th Anniversary Party', '2026-10-24', '16:00', false),
    ]
    renderBoard()

    const strip = screen.getByRole('region', { name: 'Regulars' })
    expect(within(strip).getByText(/Taco Tuesday/)).toBeTruthy()
    expect(within(strip).getByText(/Trivia/)).toBeTruthy()

    const agenda = screen.getByRole('list', { name: 'Upcoming' })
    const names = within(agenda)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    // Tonight's regular stays on today's row; later occurrences and Trivia don't repeat.
    expect(names).toEqual(['Taco Tuesday', '4th Anniversary Party'])
  })

  it('never renders the internal description', () => {
    stream.events = [ev('one', 'Open Mic', '2026-10-15', '19:00', false)]
    renderBoard()
    expect(document.body.textContent).not.toContain('Staff: tab under Smith')
  })

  it('shows no strip when there are no weekly regulars', () => {
    stream.events = [ev('one', 'Open Mic', '2026-10-15', '19:00', false)]
    renderBoard()
    expect(screen.queryByRole('region', { name: 'Regulars' })).toBeNull()
  })
})
