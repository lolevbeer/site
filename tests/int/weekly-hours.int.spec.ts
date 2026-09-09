/**
 * Holiday banner copy for the shared hours table: name the day and holiday
 * instead of a generic "Special hours this week".
 */
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  specialHoursBanner,
  WeeklyHoursTable,
} from '@/components/location/weekly-hours'
import type { WeeklyHoursDay } from '@/lib/utils/payload-api'

function day(overrides: Partial<WeeklyHoursDay> & Pick<WeeklyHoursDay, 'day'>): WeeklyHoursDay {
  return {
    date: new Date('2026-09-07T00:00:00'),
    open: '2000-01-01T16:00:00.000Z',
    close: '2000-01-02T02:00:00.000Z',
    closed: false,
    timezone: 'America/New_York',
    ...overrides,
  }
}

afterEach(cleanup)

describe('specialHoursBanner', () => {
  it('returns null when the week has no holiday overrides', () => {
    expect(specialHoursBanner([day({ day: 'monday' })])).toBeNull()
  })

  it('says Closed with the day and holiday name', () => {
    expect(
      specialHoursBanner([
        day({ day: 'monday', closed: true, open: null, close: null, holidayName: 'Labor Day' }),
      ]),
    ).toBe('Closed Monday for Labor Day')
  })

  it('names modified hours without repeating the time range', () => {
    expect(
      specialHoursBanner([day({ day: 'monday', holidayName: 'Labor Day' })]),
    ).toBe('Labor Day hours (Monday)')
  })

  it('prefers a CMS note when one is set', () => {
    expect(
      specialHoursBanner([
        day({
          day: 'monday',
          holidayName: 'Labor Day',
          note: 'Open regular hours — kitchen closed',
        }),
      ]),
    ).toBe('Open regular hours — kitchen closed')
  })
})

describe('WeeklyHoursTable holiday banner', () => {
  it('renders the specific Labor Day summary instead of generic special-hours copy', () => {
    render(
      createElement(WeeklyHoursTable, {
        variant: 'card',
        weeklyHours: [
          day({ day: 'monday', holidayName: 'Labor Day' }),
          day({ day: 'tuesday' }),
        ],
      }),
    )

    expect(screen.getByText('Labor Day hours (Monday)')).toBeTruthy()
    expect(screen.queryByText(/Special hours this week/)).toBeNull()
    expect(screen.getByText('Labor Day')).toBeTruthy()
    expect(document.querySelector('.gradient-separator')).toBeTruthy()
  })
})
