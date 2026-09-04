/**
 * Regression coverage: hideFromSite beers on a published cans menu must render
 * their tile UNLINKED. /beer/<slug> now returns notFound() for hidden beers,
 * so a linked tile would 404. DraftBeerCard already handles this via
 * CardWrapper; CanCard uses the equivalent CanCardWrapper.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { createElement } from 'react'
import { FeaturedCans } from '@/components/home/featured-menu'
import type { Menu } from '@/src/payload-types'

// jsdom has no IntersectionObserver; ScrollReveal (framer-motion inView) needs one
vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({ currentLocation: 'all' }),
}))
vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}))

function makeMenu(): Menu {
  const beer = (slug: string, hideFromSite: boolean) => ({
    product: {
      relationTo: 'beers' as const,
      value: {
        id: slug,
        name: slug,
        slug,
        abv: 5,
        description: '',
        hideFromSite,
        createdAt: '2020-01-01T00:00:00.000Z',
      },
    },
  })
  return {
    id: 'menu-1',
    name: 'Cans',
    type: 'cans',
    location: { id: 'loc-1', slug: 'lawrenceville', name: 'Lawrenceville' },
    items: [beer('visible-beer', false), beer('hidden-beer', true)],
  } as unknown as Menu
}

afterEach(cleanup)

function expectVisibleLinkedHiddenUnlinked(container: HTMLElement) {
  const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'))
  expect(hrefs).toContain('/beer/visible-beer')
  expect(hrefs).not.toContain('/beer/hidden-beer')
  expect(container.textContent).toContain('hidden-beer')
}

describe('CanCard', () => {
  it('homepage grid: visible beer links to its detail page, hidden beer does not', () => {
    const { container } = render(createElement(FeaturedCans, { menus: [makeMenu()] }))
    expectVisibleLinkedHiddenUnlinked(container)
  })

  it('fullscreen /m grid: hidden beer tile renders unlinked', () => {
    const { container } = render(createElement(FeaturedCans, { menu: makeMenu() }))
    expectVisibleLinkedHiddenUnlinked(container)
  })

  it('does not leave a separator after the ABV when a beer has no rating', () => {
    const { container } = render(createElement(FeaturedCans, { menus: [makeMenu()] }))

    expect(container.textContent).not.toContain('·')
  })
})
