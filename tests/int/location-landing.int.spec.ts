/**
 * Taproom landing reuses DraftBeerCard (compact) and BeerCard instead of a
 * one-off beer grid, so draft rows stay lighter than the can tiles.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GlassType, type Beer } from '@/lib/types/beer'
import type { PayloadLocation } from '@/lib/types/location'
import { isTaproomLandingPath } from '@/lib/config/locations'
import { LocationLanding } from '@/components/location/location-landing'

vi.mock('next/navigation', () => ({
  usePathname: () => '/lawrenceville',
}))

vi.mock('@/components/ui/page-breadcrumbs', () => ({
  PageBreadcrumbs: () => null,
}))

vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({ currentLocation: 'lawrenceville' }),
}))

vi.mock('@/components/beer/draft-beer-card', () => ({
  DraftBeerCard: ({ beer, compact }: { beer: Beer; compact?: boolean }) =>
    createElement('article', { 'data-draft-compact': String(!!compact) }, beer.name),
}))

vi.mock('@/components/beer/beer-card', () => ({
  BeerCard: ({
    beer,
    variant,
    showCta,
  }: {
    beer: Beer
    variant?: string
    showCta?: boolean
  }) =>
    createElement(
      'article',
      { 'data-can-variant': variant ?? '', 'data-show-cta': String(showCta !== false) },
      beer.name,
    ),
}))

const draftBeer: Beer = {
  variant: 'draft-beer',
  name: 'Draft Beer',
  type: 'IPA',
  abv: 6.5,
  glass: GlassType.PINT,
  description: 'A juicy hazy IPA.',
  glutenFree: false,
  image: false,
  hops: 'Citra',
  pricing: { draftPrice: 7 },
  availability: { hideFromSite: false },
}

const canBeer: Beer = {
  ...draftBeer,
  variant: 'can-beer',
  name: 'Can Beer',
}

const location = {
  id: 'loc-1',
  slug: 'lawrenceville',
  name: 'Lawrenceville',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  address: {
    street: '5247 Butler Street',
    city: 'Pittsburgh',
    state: 'PA',
    zip: '15201',
  },
  basicInfo: { phone: '(412) 336-8965' },
} as PayloadLocation

afterEach(cleanup)

describe('LocationLanding beer sections', () => {
  it('renders compact draft rows and catalog can cards', () => {
    render(
      createElement(LocationLanding, {
        location,
        weeklyHours: [],
        draftBeers: [draftBeer],
        canBeers: [canBeer],
        events: [],
        food: [],
        otherLocations: [],
      }),
    )

    const draftCard = screen.getByText('Draft Beer')
    const canCard = screen.getByText('Can Beer')

    expect(draftCard.getAttribute('data-draft-compact')).toBe('true')
    expect(canCard.getAttribute('data-can-variant')).toBe('minimal')
    expect(canCard.getAttribute('data-show-cta')).toBe('false')
    expect(screen.queryByText('A juicy hazy IPA.')).toBeNull()
    expect(screen.getByText('5247 Butler Street')).toBeTruthy()
    expect(screen.getByRole('link', { name: '(412) 336-8965' }).getAttribute('href')).toBe(
      'tel:(412) 336-8965',
    )
    expect(screen.getByText('Hours not available.')).toBeTruthy()
  })

  it('centers a single other taproom without a top rule', () => {
    render(
      createElement(LocationLanding, {
        location,
        weeklyHours: [],
        draftBeers: [],
        canBeers: [],
        events: [],
        food: [],
        otherLocations: [
          {
            ...location,
            id: 'loc-2',
            slug: 'zelienople',
            name: 'Zelienople',
          },
        ],
      }),
    )

    const heading = screen.getByRole('heading', { name: 'Our other taproom' })
    const section = heading.closest('section')
    expect(section?.classList.contains('border-t')).toBe(false)
    const list = section?.querySelector('ul')
    expect(list?.className).toContain('mx-auto')
    expect(list?.className).not.toContain('sm:grid-cols-2')
  })

  it('renders food rows from serializable items', () => {
    render(
      createElement(LocationLanding, {
        location,
        weeklyHours: [],
        draftBeers: [],
        canBeers: [],
        events: [],
        food: [
          {
            id: 'food-1',
            vendor: { name: 'El Rincon', site: 'https://example.com' },
            date: '2026-09-08',
            time: '4:00 PM',
          },
        ],
        otherLocations: [],
      }),
    )

    expect(screen.getByText('El Rincon')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Food' })).toBeTruthy()
  })

  it('renders centered event rows instead of a card grid', () => {
    render(
      createElement(LocationLanding, {
        location,
        weeklyHours: [],
        draftBeers: [],
        canBeers: [],
        events: [
          {
            id: 'evt-1',
            organizer: "Drew's Clues Trivia",
            date: '2026-09-09',
            startTime: '7pm',
            site: 'https://example.com',
          } as never,
        ],
        food: [],
        otherLocations: [],
      }),
    )

    expect(screen.getByText("Drew's Clues Trivia")).toBeTruthy()
    const heading = screen.getByRole('heading', { name: 'Upcoming events' })
    const section = heading.closest('section')
    expect(section?.querySelector('.max-w-2xl')).toBeTruthy()
    expect(section?.querySelector('.grid-cols-3')).toBeNull()
  })

  it('does not list jobs on the taproom page', () => {
    render(
      createElement(LocationLanding, {
        location,
        weeklyHours: [],
        draftBeers: [],
        canBeers: [],
        events: [],
        food: [],
        otherLocations: [],
      }),
    )

    expect(screen.queryByRole('heading', { name: 'Jobs' })).toBeNull()
  })
})

describe('isTaproomLandingPath', () => {
  const locations = [location]

  it('matches a taproom landing and ignores other routes', () => {
    expect(isTaproomLandingPath('/lawrenceville', locations)).toBe(true)
    expect(isTaproomLandingPath('/lawrenceville/', locations)).toBe(true)
    expect(isTaproomLandingPath('/', locations)).toBe(false)
    expect(isTaproomLandingPath('/beer', locations)).toBe(false)
    expect(isTaproomLandingPath('/food', locations)).toBe(false)
    expect(isTaproomLandingPath('/donate', locations)).toBe(false)
    expect(isTaproomLandingPath('/jobs', locations)).toBe(false)
    expect(isTaproomLandingPath('/unknown', locations)).toBe(false)
    expect(isTaproomLandingPath(null, locations)).toBe(false)
  })
})
