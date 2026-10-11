import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { GlassType, type Beer } from '@/lib/types/beer'
import { BeerPageContent } from '@/components/beer/beer-page-content'

const queryState = vi.hoisted(() => ({
  search: '',
  availability: 'cans',
  style: 'all',
  tag: 'all',
  setSearch: vi.fn(),
  setAvailability: vi.fn(),
  setStyle: vi.fn(),
  setTag: vi.fn(),
}))

const locationState = vi.hoisted(() => ({
  currentLocation: 'lawrenceville',
  setLocation: vi.fn(),
}))

vi.mock('nuqs', () => ({
  parseAsString: { withDefault: () => ({}) },
  useQueryState: (key: string) => {
    const states = {
      q: [queryState.search, queryState.setSearch],
      avail: [queryState.availability, queryState.setAvailability],
      style: [queryState.style, queryState.setStyle],
      tag: [queryState.tag, queryState.setTag],
    }
    return states[key as keyof typeof states]
  },
}))

vi.mock('@/components/beer/beer-card', () => ({
  BeerCard: ({ beer }: { beer: Beer }) => createElement('article', null, beer.name),
}))
vi.mock('@/components/motion', () => ({
  PageTransition: ({ children }: { children: ReactNode }) => children,
  StaggerChildren: ({ children }: { children: ReactNode }) => children,
  StaggerItem: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('@/components/ui/page-breadcrumbs', () => ({ PageBreadcrumbs: () => null }))
vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({
    currentLocation: locationState.currentLocation,
    setLocation: locationState.setLocation,
    isClient: true,
    locations: [
      { id: 'lawrenceville', slug: 'lawrenceville', name: 'Lawrenceville' },
      { id: 'zelienople', slug: 'zelienople', name: 'Zelienople' },
    ],
  }),
}))

const beer: Beer = {
  variant: 'lupula',
  name: 'Lupula',
  type: 'Hazy IPA',
  tag: 'Lupula Series',
  abv: 7,
  glass: GlassType.PINT,
  description: 'Tropical and bright.',
  glutenFree: false,
  image: false,
  pricing: {},
  availability: {
    tap: '4',
    cansAvailable: true,
    lawrenceville: { tap: '4', cansAvailable: true },
  },
}

const otherLocationBeer: Beer = {
  ...beer,
  variant: 'zelie-lager',
  name: 'Zelie Lager',
  availability: {
    tap: '2',
    cansAvailable: true,
    zelienople: { tap: '2', cansAvailable: true },
  },
}

/** Grid cards only: the full-list links repeat every beer name. */
const card = { selector: 'article' }

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  queryState.availability = 'cans'
  locationState.currentLocation = 'lawrenceville'
})

describe('BeerPageContent filters', () => {
  it('uses the shared segmented choice pattern and labeled form controls', () => {
    render(createElement(BeerPageContent, { beers: [beer] }))

    const heading = screen.getByRole('heading', { name: 'Our Beers' })
    expect(heading.parentElement?.className).toContain('text-center')
    expect(screen.getByRole('searchbox', { name: 'Search beers' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Filter by beer style' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Filter by beer series' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Choose location' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Filter by availability' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'In cans' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('keeps availability changes wired to shareable URL state', () => {
    render(createElement(BeerPageContent, { beers: [beer] }))

    fireEvent.click(screen.getByRole('button', { name: 'All' }))

    expect(queryState.setAvailability).toHaveBeenCalledOnce()
    expect(queryState.setAvailability).toHaveBeenCalledWith('all')
  })

  it('filters availability against the selected location', () => {
    queryState.availability = 'tap'

    const { rerender } = render(
      createElement(BeerPageContent, { beers: [beer, otherLocationBeer] }),
    )

    expect(screen.getByText('Lupula', card)).toBeTruthy()
    expect(screen.queryByText('Zelie Lager', card)).toBeNull()

    locationState.currentLocation = 'zelienople'
    rerender(createElement(BeerPageContent, { beers: [beer, otherLocationBeer] }))

    expect(screen.queryByText('Lupula', card)).toBeNull()
    expect(screen.getByText('Zelie Lager', card)).toBeTruthy()
  })

  it('filters cans against the selected location', () => {
    queryState.availability = 'cans'

    render(createElement(BeerPageContent, { beers: [beer, otherLocationBeer] }))

    expect(screen.getByText('Lupula', card)).toBeTruthy()
    expect(screen.queryByText('Zelie Lager', card)).toBeNull()
  })
})

describe('BeerPageContent full beer list', () => {
  it('links every beer, including ones the default filter hides', () => {
    queryState.availability = 'cans'
    const archived: Beer = { ...beer, variant: 'old-ale', name: 'Old Ale', availability: {} }

    render(createElement(BeerPageContent, { beers: [beer, archived] }))

    expect(screen.queryByText('Old Ale', { selector: 'article' })).toBeNull()
    const list = screen.getByText('All beers (2)').closest('details')
    expect(list).toBeTruthy()
    const links = Array.from(list!.querySelectorAll('a')).map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ])
    expect(links).toEqual([
      ['Lupula', '/beer/lupula'],
      ['Old Ale', '/beer/old-ale'],
    ])
  })
})
