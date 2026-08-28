import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeaturedBeers } from '@/components/home/featured-menu'
import { Products } from '@/src/collections/Products'
import type { Menu } from '@/src/payload-types'
import { OTHER_MENU_CATEGORIES, type OtherMenuCategory } from '@/lib/config/other-menu'

vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({ currentLocation: 'all' }),
}))
vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}))

function product(name: string, options: string[] = [], category?: OtherMenuCategory, price = '8') {
  return {
    product: {
      relationTo: 'products' as const,
      value: {
        id: name.toLowerCase().replaceAll(' ', '-'),
        name,
        options,
        category,
        price,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
  }
}

function otherMenu(items: ReturnType<typeof product>[]): Menu {
  return {
    id: 'other-menu',
    name: 'Other Things',
    type: 'other',
    location: { id: 'location', name: 'Lawrenceville', slug: 'lawrenceville' },
    items,
  } as unknown as Menu
}

afterEach(cleanup)

describe('Other Things fullscreen menu', () => {
  it('keeps a wholly uncategorized menu as one balanced list without category headings or option pills', () => {
    const menu = otherMenu([
      product('Top Dog Cocktails', ['Classic Margarita (7%)', 'Wildberry Margarita (7%)']),
      product('Stateside', ['Lemon Cucumber Mint', 'Grapefruit']),
      product('Chips', ['Regular', 'BBQ'], undefined, '3'),
      product('Pop', ['Coca Cola', 'Sprite'], undefined, '1'),
    ])
    const { container } = render(createElement(FeaturedBeers, { menu }))
    const board = container.querySelector('[data-other-things-board]')
    const columns = board?.querySelectorAll('[role="list"]')

    expect(board).not.toBeNull()
    expect(columns).toHaveLength(2)
    expect(columns?.[0].querySelectorAll('[role="listitem"]')).toHaveLength(2)
    expect(columns?.[1].querySelectorAll('[role="listitem"]')).toHaveLength(2)
    expect(board?.querySelectorAll('[data-other-category="all"] h3')).toHaveLength(0)
    expect(board?.querySelectorAll('[role="listitem"]')).toHaveLength(4)
    expect(board?.querySelectorAll('.rounded-full')).toHaveLength(0)
    expect(board?.textContent).toContain('Classic Margarita (7%) · Wildberry Margarita (7%)')
    expect(board?.textContent).toContain('$3')
  })

  it('groups categorized products and places only the uncategorized remainder under Other', () => {
    const menu = otherMenu([
      product('Top Dog Cocktails', [], 'cocktails-cider'),
      product('Stateside', [], 'soft-drinks'),
      product('Chips', [], 'snacks-merch'),
      product('Mystery Item'),
    ])
    const { container } = render(createElement(FeaturedBeers, { menu }))
    const board = container.querySelector('[data-other-things-board]')

    expect(board?.textContent).toContain('Cocktails & Cider')
    expect(board?.textContent).toContain('Soft Drinks')
    expect(board?.textContent).toContain('Snacks & Merch')

    const uncategorized = board?.querySelector('[data-other-category="uncategorized"]')
    expect(uncategorized?.querySelector('h3')?.textContent).toBe('Other')
    expect(uncategorized?.textContent).toContain('Mystery Item')
    expect(uncategorized?.textContent).not.toContain('Stateside')
  })

  it('keeps each rotating dark-mode color paired with its item name and price after grouping', () => {
    const menu = otherMenu([
      product('Top Dog Cocktails', [], 'cocktails-cider'),
      product('Stateside', [], 'soft-drinks'),
      product('Chips', [], 'snacks-merch'),
    ])
    const colors = ['#6be6b0', '#8b90f0', '#f0b584']
    const renderedColors = ['rgb(107, 230, 176)', 'rgb(139, 144, 240)', 'rgb(240, 181, 132)']
    const { container } = render(createElement(FeaturedBeers, { menu, itemColors: colors }))

    for (const [index, name] of ['Top Dog Cocktails', 'Stateside', 'Chips'].entries()) {
      const heading = Array.from(container.querySelectorAll('h4')).find(
        (element) => element.textContent === name,
      )
      const row = heading?.closest('[role="listitem"]')
      const price = row?.lastElementChild as HTMLElement | null
      expect((heading as HTMLElement | undefined)?.style.color).toBe(renderedColors[index])
      expect(price?.style.color).toBe(renderedColors[index])
    }
  })

  it('treats the legacy Sold Aht option as a state instead of another variant', () => {
    const { container } = render(
      createElement(FeaturedBeers, {
        menu: otherMenu([product('Hat', ['Sold Aht!'], undefined, '30')]),
      }),
    )
    const row = container.querySelector('[role="listitem"]')

    expect(row?.textContent).toContain('Sold aht')
    expect(row?.querySelector('p')).toBeNull()
    expect(row?.lastElementChild?.classList.contains('line-through')).toBe(true)
  })
})

describe('Products Other Things category field', () => {
  it('is optional and exposes the three design categories in Payload', () => {
    const category = Products.fields.find(
      (candidate) => 'name' in candidate && candidate.name === 'category',
    )

    expect(category).not.toHaveProperty('required')
    expect(category).toMatchObject({
      type: 'select',
      options: OTHER_MENU_CATEGORIES,
    })
  })
})
