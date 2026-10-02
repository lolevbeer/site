/** Selected-location headings reuse provider data without a second selector. */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FoodPageClient } from '@/src/app/(frontend)/food/food-page-client'
import { EventsPageClient } from '@/src/app/(frontend)/events/events-page-client'

const state = vi.hoisted(() => ({
  currentLocation: 'lawrenceville',
  isClient: true,
  currentLocationData: null as { name: string } | null,
  locations: [],
  cycleLocation: vi.fn(),
}))
vi.mock('@/components/location/location-provider', () => ({ useLocationContext: () => state }))
vi.mock('@/components/ui/page-breadcrumbs', () => ({ PageBreadcrumbs: () => null }))
afterEach(() => {
  cleanup()
  state.currentLocationData = null
  state.isClient = true
})

describe('schedule page location headings', () => {
  it('keeps default server location out of headings until hydration', () => {
    state.isClient = false
    state.currentLocationData = { name: 'Lolev Lawrenceville' }
    const food = render(<FoodPageClient initialSchedules={[]} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Food')
    state.isClient = true
    state.currentLocationData = { name: 'Lolev Zelienople' }
    food.rerender(<FoodPageClient initialSchedules={[]} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Food at Lolev Zelienople')
    food.unmount()
    state.isClient = false
    render(<EventsPageClient initialEvents={[]} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Events')
  })
  it.each(['Lolev Lawrenceville', 'Lolev Zelienople'])('names %s on both hubs', (name) => {
    state.currentLocationData = { name }
    const food = render(<FoodPageClient initialSchedules={[]} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(`Food at ${name}`)
    food.unmount()
    render(<EventsPageClient initialEvents={[]} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(`Events at ${name}`)
  })
  it('keeps generic headings when location data is missing', () => {
    const food = render(<FoodPageClient initialSchedules={[]} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Food')
    food.unmount()
    render(<EventsPageClient initialEvents={[]} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Events')
  })

  it('renders projected items with time || start, description fallback, and unsafe site stripped', () => {
    state.locations = []
    const food = render(
      <FoodPageClient
        initialSchedules={[
          {
            vendor: 'Truck',
            date: '2099-01-02',
            location: 'lawrenceville',
            time: '',
            start: '2000-01-01T23:00:00.000Z',
            site: 'javascript:alert(1)',
          },
        ]}
      />,
    )
    expect(screen.getByText('Truck')).toBeTruthy()
    expect(screen.getByText('6pm')).toBeTruthy()
    expect(document.querySelector('a[href^="javascript"]')).toBeNull()
    food.unmount()
    render(
      <EventsPageClient
        initialEvents={[
          {
            id: 'e1',
            title: 'Trivia',
            description: 'Trivia',
            date: '2099-01-02',
            time: '7pm',
            location: 'lawrenceville',
          },
          {
            id: 'e2',
            title: 'Music',
            description: 'Live band',
            date: '2099-01-03',
            time: '8pm',
            location: 'lawrenceville',
          },
        ]}
      />,
    )
    expect(screen.getByText('Live band')).toBeTruthy()
    expect(screen.getAllByText('Trivia')).toHaveLength(1)
  })

  it('explains how to read each schedule only when rows are listed', () => {
    state.locations = []
    const row = {
      vendor: 'Truck',
      date: '2099-01-02',
      location: 'lawrenceville',
      time: '5pm',
      start: '',
    }
    const food = render(<FoodPageClient initialSchedules={[row]} />)
    expect(screen.getByText(/vendors and serving times for this taproom/i)).toBeTruthy()
    food.unmount()
    const emptyFood = render(<FoodPageClient initialSchedules={[]} />)
    expect(screen.queryByText(/vendors and serving times for this taproom/i)).toBeNull()
    emptyFood.unmount()
    const events = render(
      <EventsPageClient
        initialEvents={[
          {
            id: 'e1',
            title: 'Trivia',
            description: 'Trivia',
            date: '2099-01-02',
            time: '7pm',
            location: 'lawrenceville',
          },
        ]}
      />,
    )
    expect(screen.getByText(/dates, times, and activities are listed below/i)).toBeTruthy()
    events.unmount()
    render(<EventsPageClient initialEvents={[]} />)
    expect(screen.queryByText(/dates, times, and activities are listed below/i)).toBeNull()
  })
})
