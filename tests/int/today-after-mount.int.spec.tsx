/**
 * "Today" is the viewer's day, not the day the ISR page was rendered. Server
 * HTML marks no day as today (so a page cached before midnight never
 * highlights yesterday, and hydration never mismatches); the client marks it
 * once mounted.
 */
import type React from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WeeklyHoursTable } from '@/components/location/weekly-hours'
import { ScheduleList } from '@/components/ui/schedule-list'
import type { WeeklyHoursDay } from '@/lib/utils/payload-api'
import { FoodPageClient } from '@/src/app/(frontend)/food/food-page-client'
import { EventsPageClient } from '@/src/app/(frontend)/events/events-page-client'
import { QuickInfoCards } from '@/components/home/quick-info-cards'
import { EventStatus, EventType, type BreweryEvent } from '@/lib/types/event'

vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({
    locations: [{ id: 'lawrenceville', slug: 'lawrenceville', name: 'Lawrenceville' }],
    currentLocation: 'lawrenceville',
    setLocation: () => {},
    cycleLocation: () => {},
    isClient: true,
  }),
}))
vi.mock('@/components/ui/page-breadcrumbs', () => ({ PageBreadcrumbs: () => null }))
vi.mock('@/components/motion', () => ({ MotionCard: 'div' }))

function day(name: WeeklyHoursDay['day']): WeeklyHoursDay {
  return {
    day: name,
    date: new Date('2026-09-07T00:00:00'),
    open: '2000-01-01T16:00:00.000Z',
    close: '2000-01-02T02:00:00.000Z',
    closed: false,
    timezone: 'America/New_York',
  }
}

const hours = [day('monday'), day('tuesday')]
const items = [{ id: 'a', date: '2026-09-07', title: 'Monday trivia' }]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  // Monday 2026-09-07, noon in Pittsburgh.
  vi.setSystemTime(new Date('2026-09-07T16:00:00Z'))
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('WeeklyHoursTable today highlight', () => {
  it('highlights no day in server HTML', () => {
    const html = renderToStaticMarkup(<WeeklyHoursTable weeklyHours={hours} variant="card" />)
    expect(html).not.toContain('text-primary')
  })

  it('highlights today on the client', () => {
    render(<WeeklyHoursTable weeklyHours={hours} variant="card" />)
    const monday = screen.getByRole('rowheader', { name: 'Monday' }).closest('tr')
    const tuesday = screen.getByRole('rowheader', { name: 'Tuesday' }).closest('tr')
    expect(monday?.className).toContain('text-primary')
    expect(tuesday?.className).not.toContain('text-primary')
  })
})

describe('ScheduleList today heading', () => {
  it('prints the full date, not "Today", in server HTML', () => {
    const html = renderToStaticMarkup(<ScheduleList items={items} />)
    expect(html).toContain('Monday, September 7, 2026')
    expect(html).not.toContain('Today')
  })

  it('says Today on the client', () => {
    render(<ScheduleList items={items} />)
    const heading = screen.getByRole('heading', { name: 'Today' })
    expect(heading.className).toContain('text-primary')
  })
})

describe('midnight rollover', () => {
  it('moves the hours highlight and the Today heading to the next day', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    // Monday 2026-09-07, 23:59 in Pittsburgh.
    vi.setSystemTime(new Date('2026-09-08T03:59:00Z'))
    render(
      <>
        <WeeklyHoursTable weeklyHours={hours} variant="card" />
        <ScheduleList
          items={[...items, { id: 'b', date: '2026-09-08', title: 'Tuesday tacos' }]}
        />
      </>,
    )
    const row = (name: string) => screen.getByRole('rowheader', { name }).closest('tr')
    expect(row('Monday')?.className).toContain('text-primary')
    expect(screen.getByRole('heading', { name: 'Today' }).textContent).toBe('Today')
    expect(screen.getByRole('heading', { name: 'Tomorrow' })).toBeTruthy()

    act(() => vi.advanceTimersByTime(2 * 60_000))

    expect(row('Monday')?.className).not.toContain('text-primary')
    expect(row('Tuesday')?.className).toContain('text-primary')
    expect(screen.queryByRole('heading', { name: 'Tomorrow' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Monday, September 7, 2026' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy()
  })

  it('runs one minute timer however many rows ask for today', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date('2026-09-07T16:00:00Z'))
    render(
      <WeeklyHoursTable
        weeklyHours={[day('monday'), day('tuesday'), day('wednesday'), day('thursday')]}
        variant="card"
      />,
    )
    expect(vi.getTimerCount()).toBe(1)
  })
})

describe('hydrating cached HTML after midnight', () => {
  function hydrate(node: React.ReactElement, serverTime: string, clientTime: string) {
    vi.setSystemTime(new Date(serverTime))
    const container = document.createElement('div')
    container.innerHTML = renderToString(node)
    document.body.appendChild(container)
    vi.setSystemTime(new Date(clientTime))
    const errors = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(errors)
    act(() => {
      hydrateRoot(container, node, { onRecoverableError: errors })
    })
    return { container, errors }
  }

  // Rendered Monday 23:59 EDT, hydrated Tuesday 00:01 EDT.
  const at2359 = '2026-09-08T03:59:00Z'
  const at0001 = '2026-09-08T04:01:00Z'

  it('ScheduleList hydrates without a mismatch, then says Today', () => {
    const node = <ScheduleList items={[{ id: 'b', date: '2026-09-08', title: 'Tacos' }]} />
    const { errors } = hydrate(node, at2359, at0001)
    expect(errors).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy()
  })

  it('/food keeps the server rows through hydration, then drops yesterday', () => {
    const node = (
      <FoodPageClient
        initialSchedules={[
          { vendor: 'Yesterday Truck', date: '2026-09-07', time: '17:00', location: 'lawrenceville' },
          { vendor: 'Today Truck', date: '2026-09-08', time: '17:00', location: 'lawrenceville' },
        ]}
      />
    )
    const { errors } = hydrate(node, at2359, at0001)
    expect(errors).not.toHaveBeenCalled()
    expect(screen.queryByText('Yesterday Truck')).toBeNull()
    expect(screen.getByText('Today Truck')).toBeTruthy()
  })

  it('/events keeps the server rows through hydration, then drops yesterday', () => {
    const ev = (id: string, date: string, title: string): BreweryEvent => ({
      id,
      title,
      date,
      time: '19:00',
      vendor: title,
      type: EventType.SPECIAL_EVENT,
      status: EventStatus.SCHEDULED,
      location: 'lawrenceville',
    })
    const node = (
      <EventsPageClient
        initialEvents={[ev('y', '2026-09-07', 'Yesterday show'), ev('t', '2026-09-08', 'Today show')]}
      />
    )
    const { errors } = hydrate(node, at2359, at0001)
    expect(errors).not.toHaveBeenCalled()
    expect(screen.queryByText('Yesterday show')).toBeNull()
    expect(screen.getByText('Today show')).toBeTruthy()
  })

  it('home Next Event card shows the full date in HTML and Today after mount', () => {
    const node = (
      <QuickInfoCards nextEvent={{ name: 'Trivia', date: '2026-09-07', location: 'lawrenceville' }} />
    )
    vi.setSystemTime(new Date(at2359))
    expect(renderToString(node)).toContain('Monday, September 7, 2026')
    expect(renderToString(node)).not.toContain('Today')
    const { errors } = hydrate(node, at2359, '2026-09-07T16:00:00Z')
    expect(errors).not.toHaveBeenCalled()
    expect(screen.getByText(/Today ·/)).toBeTruthy()
  })
})
