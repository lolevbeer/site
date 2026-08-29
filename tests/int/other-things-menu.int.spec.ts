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

function renderOtherThings(items: ReturnType<typeof product>[], itemColors?: string[]) {
  const { container } = render(createElement(FeaturedBeers, { menu: otherMenu(items), itemColors }))
  const board = container.querySelector('[data-other-things-board]')
  expect(board).not.toBeNull()
  return board as HTMLElement
}

afterEach(cleanup)

describe('Other Things fullscreen menu', () => {
  it('uses the full board and maximum scale for a single item', () => {
    const board = renderOtherThings([product('Stateside')])
    const heading = board.querySelector('h4') as HTMLElement | null

    expect(board.querySelectorAll('[role="list"]')).toHaveLength(1)
    expect(heading?.style.fontSize).toBe('6.3vh')
  })

  it('keeps a wholly uncategorized menu as one balanced list without category headings or option pills', () => {
    const board = renderOtherThings([
      product('Top Dog Cocktails', ['Classic Margarita (7%)', 'Wildberry Margarita (7%)']),
      product('Stateside', ['Lemon Cucumber Mint', 'Grapefruit']),
      product('Chips', ['Regular', 'BBQ'], undefined, '3'),
      product('Pop', ['Coca Cola', 'Sprite'], undefined, '1'),
    ])
    const columns = board.querySelectorAll('[role="list"]')

    expect(columns).toHaveLength(2)
    expect(columns[0].querySelectorAll('[role="listitem"]')).toHaveLength(2)
    expect(columns[1].querySelectorAll('[role="listitem"]')).toHaveLength(2)
    expect(board.querySelectorAll('[data-other-category="all"] h3')).toHaveLength(0)
    expect(board.querySelectorAll('[role="listitem"]')).toHaveLength(4)
    expect(board.querySelectorAll('.rounded-full')).toHaveLength(0)
    expect(board.textContent).toContain('Classic Margarita (7%) · Wildberry Margarita (7%)')
    expect(board.textContent).toContain('$3')
    expect((board.querySelector('h4') as HTMLElement | null)?.style.fontSize).toBe('6.3vh')
  })

  it('keeps the baseline sizing when all twelve slots are occupied', () => {
    const board = renderOtherThings(
      Array.from({ length: 12 }, (_, index) => product(`Item ${index + 1}`)),
    )
    const heading = board.querySelector('h4') as HTMLElement | null

    expect(heading?.style.fontSize).toBe('2.8vh')
  })

  it('scales and vertically distributes an eight-item board through the available height', () => {
    const board = renderOtherThings(
      Array.from({ length: 8 }, (_, index) => product(`Item ${index + 1}`)),
    )
    const group = board.querySelector('[data-other-category="all"]')
    const rows = group?.lastElementChild

    expect((board.querySelector('h4') as HTMLElement | null)?.style.fontSize).toBe('4.2vh')
    expect((group as HTMLElement | null)?.style.flexGrow).toBe('4')
    expect(rows?.classList.contains('justify-evenly')).toBe(true)
  })

  it('groups categorized products and places only the uncategorized remainder under Other', () => {
    const board = renderOtherThings([
      product('Top Dog Cocktails', [], 'cocktails-cider'),
      product('Stateside', [], 'soft-drinks'),
      product('Chips', [], 'snacks-merch'),
      product('Mystery Item'),
    ])

    expect(board.textContent).toContain('Cocktails & Cider')
    expect(board.textContent).toContain('Soft Drinks')
    expect(board.textContent).toContain('Snacks & Merch')

    const uncategorized = board.querySelector('[data-other-category="uncategorized"]')
    expect(uncategorized?.querySelector('h3')?.textContent).toBe('Other')
    expect(uncategorized?.textContent).toContain('Mystery Item')
    expect(uncategorized?.textContent).not.toContain('Stateside')
  })

  it('keeps each rotating dark-mode color paired with its item name and price after grouping', () => {
    const items = [
      product('Top Dog Cocktails', [], 'cocktails-cider'),
      product('Stateside', [], 'soft-drinks'),
      product('Chips', [], 'snacks-merch'),
    ]
    const colors = ['#6be6b0', '#8b90f0', '#f0b584']
    const renderedColors = ['rgb(107, 230, 176)', 'rgb(139, 144, 240)', 'rgb(240, 181, 132)']
    const board = renderOtherThings(items, colors)

    for (const [index, name] of ['Top Dog Cocktails', 'Stateside', 'Chips'].entries()) {
      const heading = Array.from(board.querySelectorAll('h4')).find(
        (element) => element.textContent === name,
      )
      const row = heading?.closest('[role="listitem"]')
      const price = row?.lastElementChild as HTMLElement | null
      expect((heading as HTMLElement | undefined)?.style.color).toBe(renderedColors[index])
      expect(price?.style.color).toBe(renderedColors[index])
    }
  })

  it('treats the legacy Sold Aht option as a state instead of another variant', () => {
    const board = renderOtherThings([product('Hat', ['Sold Aht!'], undefined, '30')])
    const row = board.querySelector('[role="listitem"]')

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
