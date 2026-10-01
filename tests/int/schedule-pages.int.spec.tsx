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
})
