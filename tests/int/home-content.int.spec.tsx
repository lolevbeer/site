/** Home orientation line lists the loaded taprooms, never hardcoded city names. */
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HomeContent } from '@/components/home/home-content'

const state = vi.hoisted(() => ({
  locations: [] as Array<{ id: string; slug: string; name: string }>,
}))
vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => state,
}))
vi.mock('@/components/home/hero-section', () => ({ HeroSection: () => null }))
vi.mock('@/components/home/featured-menu', () => ({ FeaturedBeers: () => null }))
vi.mock('@/components/home/quick-info-cards', () => ({ QuickInfoCards: () => null }))
vi.mock('@/components/location/location-cards', () => ({ LocationCards: () => null }))
vi.mock('@/components/ui/scroll-reveal', () => ({
  ScrollReveal: ({ children }: { children: ReactNode }) => children,
}))

const props = { heroBeers: [], draftMenus: [], beerCount: {}, cansCount: {}, children: null }
afterEach(cleanup)

describe('HomeContent orientation', () => {
  it('names the loaded taprooms under Our Locations', () => {
    state.locations = [
      { id: '1', slug: 'a', name: 'Alpha' },
      { id: '2', slug: 'b', name: 'Beta' },
    ]
    render(<HomeContent {...props} />)
    expect(screen.getByRole('heading', { name: 'Our Locations' })).toBeTruthy()
    expect(
      screen.getByText('Alpha and Beta: hours, directions, food, events, and what is on tap.'),
    ).toBeTruthy()
  })

  it('renders no orientation line without locations', () => {
    state.locations = []
    render(<HomeContent {...props} />)
    expect(screen.queryByText(/hours, directions/)).toBeNull()
  })
})
