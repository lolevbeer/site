/**
 * "Today" is the viewer's day, not the day the ISR page was rendered. Server
 * HTML marks no day as today (so a page cached before midnight never
 * highlights yesterday, and hydration never mismatches); the client marks it
 * once mounted.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WeeklyHoursTable } from '@/components/location/weekly-hours'
import { ScheduleList } from '@/components/ui/schedule-list'
import type { WeeklyHoursDay } from '@/lib/utils/payload-api'

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
