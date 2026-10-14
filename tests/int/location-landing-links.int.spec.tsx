/**
 * The taproom landing's "View all" links must carry `?loc=` so the beer,
 * events, and food pages open on this taproom instead of the default one.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PayloadLocation } from '@/lib/types/location'
import { LocationLanding } from '@/components/location/location-landing'

vi.mock('@/components/ui/page-breadcrumbs', () => ({
  PageBreadcrumbs: () => null,
}))

vi.mock('@/components/beer/draft-beer-card', () => ({ DraftBeerCard: () => null }))
vi.mock('@/components/beer/beer-card', () => ({ BeerCard: () => null }))

const location = {
  id: 'loc-2',
  slug: 'zelienople',
  name: 'Zelienople',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as PayloadLocation

afterEach(cleanup)

describe('LocationLanding view-all links', () => {
  it('append the taproom slug as ?loc=', () => {
    render(
      <LocationLanding
        location={location}
        weeklyHours={[]}
        draftBeers={[]}
        canBeers={[]}
        events={[{ id: 'evt-1', organizer: 'Trivia', date: '2026-09-09' } as never]}
        food={[{ id: 'food-1', vendor: { name: 'El Rincon' }, date: '2026-09-08' }]}
        otherLocations={[]}
      />,
    )

    expect(screen.getByRole('link', { name: 'View all beers' }).getAttribute('href')).toBe(
      '/beer?avail=tap&loc=zelienople',
    )
    expect(screen.getByRole('link', { name: 'View all events' }).getAttribute('href')).toBe(
      '/events?loc=zelienople',
    )
    expect(screen.getByRole('link', { name: 'View food schedule' }).getAttribute('href')).toBe(
      '/food?loc=zelienople',
    )
  })
})
