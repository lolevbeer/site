/**
 * Menus show prices the way the beer page does (formatPrice): cents always
 * have two digits ($4.50, never $4.5) and whole dollars have none ($8).
 * Free-text prices on the cans board that aren't a plain number ("2 for $10")
 * show as entered.
 */
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeaturedBeers, FeaturedCans } from '@/components/home/featured-menu'
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

const SINGLE_DIGIT_CENTS = /\$\d+\.\d(?!\d)/

function menu(type: 'draft' | 'cans' | 'other', items: unknown[]): Menu {
  return {
    id: `${type}-menu`,
    name: type,
    type,
    location: { id: 'loc-1', slug: 'lawrenceville', name: 'Lawrenceville' },
    items,
  } as unknown as Menu
}

function beer(slug: string, prices: Record<string, number>) {
  return {
    product: {
      relationTo: 'beers' as const,
      value: {
        id: slug,
        name: slug,
        slug,
        abv: 6,
        description: '',
        hideFromSite: false,
        createdAt: '2020-01-01T00:00:00.000Z',
        ...prices,
      },
    },
  }
}

function product(name: string, price: string) {
  return {
    product: {
      relationTo: 'products' as const,
      value: { id: name, name, options: [], price, createdAt: '2020-01-01T00:00:00.000Z' },
    },
  }
}

afterEach(cleanup)

describe('menu prices', () => {
  it('draft board: half and full pours', () => {
    const draft = menu('draft', [
      beer('samo', { draftPrice: 12.5, halfPour: 4.5 }),
      beer('lupula', { draftPrice: 8, halfPour: 5 }),
    ])
    const text = render(createElement(FeaturedBeers, { menu: draft })).container.textContent

    expect(text).toContain('$4.50')
    expect(text).toContain('$12.50')
    expect(text).toContain('$8')
    expect(text).not.toMatch(SINGLE_DIGIT_CENTS)
  })

  it('cans board: four packs and bottles', () => {
    const cans = menu('cans', [
      beer('akis', { fourPack: 17.5, bottlePrice: 4.5 }),
      beer('tyrus', { fourPack: 16 }),
    ])
    const text = render(createElement(FeaturedCans, { menu: cans })).container.textContent

    expect(text).toContain('$17.50')
    expect(text).toContain('$4.50')
    expect(text).toContain('$16')
    expect(text).not.toMatch(SINGLE_DIGIT_CENTS)
  })

  it('cans board: product prices are free text', () => {
    const cans = menu('cans', [
      product('Growler', '2 for $10'),
      product('Hat', '5'),
      product('Glass', '$4.5'),
    ])
    const text = render(createElement(FeaturedCans, { menu: cans })).container.textContent

    expect(text).toContain('2 for $10 • Four Pack')
    expect(text).toContain('$5 • Four Pack')
    expect(text).toContain('$4.50 • Four Pack')
    expect(text).not.toContain('$2 •')
  })

  it('cans board: a product priced 0 shows no price line', () => {
    const cans = menu('cans', [product('Sticker', '0')])
    const text = render(createElement(FeaturedCans, { menu: cans })).container.textContent

    expect(text).toContain('Sticker')
    expect(text).not.toContain('Four Pack')
  })

  it('other board: product prices', () => {
    const other = menu('other', [product('Hat', '4.5'), product('Glass', '8')])
    const text = render(createElement(FeaturedBeers, { menu: other })).container.textContent

    expect(text).toContain('$4.50')
    expect(text).toContain('$8')
    expect(text).not.toMatch(SINGLE_DIGIT_CENTS)
  })

  it('draft board: price columns widen only when a price has cents', () => {
    const columns = (items: unknown[]) =>
      [
        ...render(
          createElement(FeaturedBeers, { menu: menu('draft', items) }),
        ).container.querySelectorAll<HTMLElement>('[style*="grid-template-columns"]'),
      ].map((el) => el.style.gridTemplateColumns)

    const whole = columns([beer('lupula', { draftPrice: 8, halfPour: 5 })])
    cleanup()
    const cents = columns([beer('samo', { draftPrice: 12.5, halfPour: 4.5 })])

    expect(whole.length).toBeGreaterThan(1) // header and row
    expect(whole.every((c) => c.endsWith('7vh 7vh'))).toBe(true)
    expect(cents.every((c) => c.endsWith('12.5vh 12.5vh'))).toBe(true)
  })

  it.each(['draft', 'other'] as const)('%s board: product prices are free text', (type) => {
    const board = menu(type, [product('Growler', '2 for $10'), product('Sticker', '0')])
    const text = render(createElement(FeaturedBeers, { menu: board })).container.textContent

    expect(text).toContain('2 for $10')
    expect(text).not.toContain('$2')
    expect(text).toContain('Sticker')
    expect(text).not.toMatch(/Sticker[^$]*\$0|\b0\b/)
  })
})

it.each(['15', '2 for $25', '0'])(
  'cans sale override %s wins over the regular four-pack price',
  (price) => {
    const cans = menu('cans', [{ ...beer('sale', { fourPack: 18, bottlePrice: 8 }), price }])
    const text = render(createElement(FeaturedCans, { menu: cans })).container.textContent
    expect(text).not.toContain('$18')
    if (price !== '0') expect(text).toContain(price === '15' ? '$15' : price)
    expect(text).toContain('$8')
  },
)
