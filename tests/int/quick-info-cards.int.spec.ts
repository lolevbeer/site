/** Selected-taproom visit shortcuts use holiday-aware hours and Pittsburgh's day. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { QuickInfoCards } from '@/components/home/quick-info-cards'
import type { WeeklyHoursDay } from '@/lib/utils/payload-api'
import { getLocationDirectionsUrl } from '@/lib/config/locations'
import type { PayloadLocation } from '@/lib/types/location'

const { context } = vi.hoisted(() => ({
  context: {
    locations: [
      {
        id: '1',
        slug: 'lawrenceville',
        name: 'Lawrenceville',
        address: { directionsUrl: 'https://example.com/directions' },
      },
      { id: '2', slug: 'zelienople', name: 'Zelienople', coordinates: [-80.14, 40.79] },
    ],
    currentLocation: 'lawrenceville',
    isClient: true,
  },
}))
vi.mock('@/components/location/location-provider', () => ({ useLocationContext: () => context }))

function day(overrides: Partial<WeeklyHoursDay> = {}): WeeklyHoursDay {
  return {
    day: 'monday',
    date: new Date('2026-09-07T16:00:00Z'),
    open: '16:00',
    close: '22:00',
    closed: false,
    timezone: 'America/New_York',
    ...overrides,
  }
}
const props = {
  beerCount: { lawrenceville: 10, zelienople: 12 },
  cansCount: { lawrenceville: 8, zelienople: 9 },
  weeklyHours: {
    lawrenceville: [day({ closed: true, holidayName: 'Labor Day' })],
    zelienople: [day({ open: '12:00', close: '18:00', holidayName: 'Labor Day' })],
  },
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-08T02:00:00Z')) // Still Monday in Pittsburgh.
  context.currentLocation = 'lawrenceville'
  context.isClient = true
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('QuickInfoCards visit summary', () => {
  it('shows the selected taproom holiday closure and location-scoped shortcuts', () => {
    render(createElement(QuickInfoCards, props))
    expect(screen.getByText('Lawrenceville')).toBeTruthy()
    expect(screen.getByText(/Today: Closed/)).toBeTruthy()
    expect(screen.getByText(/Labor Day/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Directions' }).getAttribute('href')).toBe(
      'https://example.com/directions',
    )
    for (const [name, href] of [
      ['On Tap (10)', '/?loc=lawrenceville#draft'],
      ['Cans (8)', '/?loc=lawrenceville#cans'],
      ['Food', '/food?loc=lawrenceville'],
      ['Events', '/events?loc=lawrenceville'],
    ]) {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href)
    }
    expect(screen.queryByText('Zelienople')).toBeNull()
  })
  it('changes hours, counts, and coordinates directions with the selected taproom', () => {
    context.currentLocation = 'zelienople'
    render(createElement(QuickInfoCards, props))
    expect(screen.getByText(/Today: 12 PM - 6 PM/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'On Tap (12)' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Directions' }).getAttribute('href')).toContain(
      'destination=40.79,-80.14',
    )
  })
  it('uses the new Pittsburgh day after midnight without falling back to regular hours', () => {
    vi.setSystemTime(new Date('2026-09-08T04:01:00Z'))
    render(createElement(QuickInfoCards, props))
    expect(screen.getByText('Today: Hours not available')).toBeTruthy()
    expect(screen.queryByText(/Labor Day/)).toBeNull()
  })
  it('does not mistake next week Sunday for today at the UTC week boundary', () => {
    vi.setSystemTime(new Date('2026-09-07T02:00:00Z'))
    render(
      createElement(QuickInfoCards, {
        weeklyHours: {
          lawrenceville: [
            day({
              day: 'sunday',
              date: new Date('2026-09-13T00:00:00Z'),
              holidayName: 'Future holiday',
              closed: true,
            }),
          ],
        },
      }),
    )
    expect(screen.getByText('Today: Hours not available')).toBeTruthy()
    expect(screen.queryByText(/Future holiday/)).toBeNull()
  })
  it('does not flash default taproom facts before the stored location is restored', () => {
    context.isClient = false
    render(createElement(QuickInfoCards, props))
    expect(screen.getByRole('region', { name: 'Plan your visit' })).toBeTruthy()
    expect(screen.getByText('Choose a taproom above to plan your visit')).toBeTruthy()
    expect(screen.queryByText('Lawrenceville')).toBeNull()
    expect(screen.queryByText(/Closed|Labor Day/)).toBeNull()
    expect(screen.queryByRole('link', { name: 'Directions' })).toBeNull()
  })
  it('matches a UTC-midnight source calendar date and preserves hours timezone', () => {
    render(
      createElement(QuickInfoCards, {
        weeklyHours: {
          lawrenceville: [
            day({
              date: new Date('2026-09-07T00:00:00Z'),
              open: '2026-09-07T20:00:00Z',
              close: '2026-09-08T02:00:00Z',
            }),
          ],
        },
      }),
    )
    expect(screen.getByText('Today: 4 PM - 10 PM')).toBeTruthy()
  })
  it('preserves the address directions fallback and marks unavailable directions', () => {
    const location = {
      address: { street: '111 Main Street', city: 'Zelienople', state: 'PA', zip: '16063' },
    } as PayloadLocation
    expect(getLocationDirectionsUrl(location)).toBe(
      'https://www.google.com/maps/search/?api=1&query=111%20Main%20Street%2C%20Zelienople%2C%20PA%2016063',
    )
    expect(getLocationDirectionsUrl({} as PayloadLocation)).toBe('#')
  })
  it('keeps shortcuts useful when counts and hours are unavailable', () => {
    render(createElement(QuickInfoCards))
    expect(screen.getByText('Today: Hours not available')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'On Tap' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Cans' })).toBeTruthy()
  })
})
