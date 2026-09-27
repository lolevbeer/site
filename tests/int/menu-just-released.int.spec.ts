/**
 * "Just Released" on menus is automatic: a beer is marked when it was created
 * within the last 7 days. There is no manual override, so a leftover stored
 * `justReleased: true` on an older beer must neither earn it the badge nor
 * switch auto-marking off for everyone else.
 */
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeaturedBeers } from '@/components/home/featured-menu'
import type { Menu } from '@/src/payload-types'

vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({ currentLocation: 'all' }),
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}))

vi.mock('@/components/ui/scroll-reveal', () => ({
  ScrollReveal: ({ children }: { children: unknown }) => children,
}))

const DAY = 24 * 60 * 60 * 1000

function beerItem(name: string, createdAt: Date, extra: Record<string, unknown> = {}) {
  return {
    product: {
      relationTo: 'beers' as const,
      value: {
        id: name,
        name,
        slug: name,
        abv: 6,
        glass: 'pint',
        draftPrice: 7,
        hideFromSite: false,
        createdAt: createdAt.toISOString(),
        ...extra,
      },
    },
  }
}

function rowFor(container: HTMLElement, name: string): HTMLElement {
  const rows = Array.from(container.querySelectorAll<HTMLElement>('[role="listitem"]'))
  const row = rows.find((r) => r.textContent?.includes(name))
  if (!row) throw new Error(`No menu row for ${name}`)
  return row
}

afterEach(cleanup)

describe('menu "Just Released" badge', () => {
  it('marks only beers created in the last 7 days, ignoring any stored manual flag', () => {
    const menu = {
      id: 'draft-menu',
      name: 'Draft Beer',
      type: 'draft',
      location: { id: 'loc-1', slug: 'lawrenceville', name: 'Lawrenceville' },
      items: [
        beerItem('Fresh Pale', new Date(Date.now() - 2 * DAY)),
        beerItem('Old Stout', new Date(Date.now() - 90 * DAY), { justReleased: true }),
      ],
    } as unknown as Menu

    const { container } = render(createElement(FeaturedBeers, { menu }))

    expect(rowFor(container, 'Fresh Pale').textContent).toContain('Just Released')
    expect(rowFor(container, 'Old Stout').textContent).not.toContain('Just Released')
  })
})
