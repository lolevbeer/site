/**
 * Beer map hours reuse WeeklyHoursTable (full day names, holiday banner,
 * gradient separator) instead of a one-off accordion.
 */
import { readFileSync } from 'node:fs'
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BeerMapContent } from '@/components/beer/beer-map-content'
import type { WeeklyHoursDay } from '@/lib/utils/payload-api'

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}))

vi.mock('@/components/ui/page-breadcrumbs', () => ({
  PageBreadcrumbs: () => null,
}))

vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({
    locations: [
      { id: '1', slug: 'lawrenceville', name: 'Lawrenceville' },
      { id: '2', slug: 'zelienople', name: 'Zelienople' },
    ],
  }),
}))

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

const weeklyHours: Record<string, WeeklyHoursDay[]> = {
  lawrenceville: [day({ day: 'monday', holidayName: 'Labor Day' }), day({ day: 'tuesday' })],
  zelienople: [day({ day: 'monday' }), day({ day: 'tuesday' })],
}

afterEach(cleanup)

describe('BeerMapContent hours', () => {
  it('lets visitors scroll the page past the interactive map', () => {
    // WebGL cannot run in jsdom; guard the actual Map interaction option.
    const source = readFileSync('components/ui/distributor-map.tsx', 'utf8')
    expect(source).toMatch(/<Map\s[\s\S]*?\scooperativeGestures(?:\s|=)/)
  })
  it('places streamed retailer search before taproom hours', () => {
    render(
      createElement(
        BeerMapContent,
        { weeklyHours },
        createElement('input', { 'aria-label': 'Search retailers' }),
      ),
    )
    const search = screen.getByRole('textbox', { name: 'Search retailers' })
    const taproom = screen.getByRole('heading', { name: 'Lawrenceville' })
    expect(search.compareDocumentPosition(taproom) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText(/Taprooms below, then the map/)).toBeNull()
  })
  it('renders the shared weekly hours table for each taproom, not an accordion', () => {
    render(createElement(BeerMapContent, { weeklyHours }))

    expect(screen.getByRole('heading', { name: 'Lawrenceville' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Zelienople' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Lawrenceville/ })).toBeNull()

    expect(screen.getAllByText('Monday').length).toBe(2)
    expect(screen.getByText('Labor Day hours (Monday)')).toBeTruthy()
    expect(document.querySelectorAll('.gradient-separator').length).toBe(2)
  })
})
