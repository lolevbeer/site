import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeaturedBeers } from '@/components/home/featured-menu'
import type { Menu } from '@/src/payload-types'

vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({ currentLocation: 'all' }),
}))

function makeDraftMenu(): Menu {
  const item = (slug: string, collab = false) => ({
    product: {
      relationTo: 'beers' as const,
      value: {
        id: slug,
        name: slug,
        slug,
        abv: 6.5,
        glass: 'pint',
        description: 'A complete description that can wrap without changing row sizing.',
        hops: 'Citra, Mosaic, Nelson Sauvin',
        draftPrice: 7,
        hideFromSite: false,
        collab,
        collabBrewery: collab ? 'Azvex Brewing Company' : undefined,
        createdAt: '2020-01-01T00:00:00.000Z',
      },
    },
  })

  return {
    id: 'draft-menu',
    name: 'Draft Beer',
    type: 'draft',
    location: { id: 'loc-1', slug: 'lawrenceville', name: 'Lawrenceville' },
    items: Array.from({ length: 12 }, (_, index) => item(`beer-${index + 1}`, index === 0)),
  } as unknown as Menu
}

afterEach(cleanup)

describe('Fullscreen draft menu row sizing', () => {
  it('uses two separate header bars and distributes natural-height rows', () => {
    const { container } = render(createElement(FeaturedBeers, { menu: makeDraftMenu() }))
    const columns = Array.from(container.querySelectorAll('[role="list"]'))
    const boardGrid = columns[0]?.parentElement?.parentElement
    const headerBar = boardGrid?.previousElementSibling as HTMLElement | null
    const headerColumns = Array.from(headerBar?.children ?? [])

    expect(container.textContent).toContain('Collab · Azvex Brewing Company')
    expect(columns).toHaveLength(2)
    expect(boardGrid?.children).toHaveLength(2)
    expect(boardGrid?.classList.contains('md:grid-cols-2')).toBe(true)
    expect((boardGrid as HTMLElement | undefined)?.style.gap).toBe('2.5vw')
    expect(headerColumns).toHaveLength(2)
    expect(headerBar?.style.columnGap).toBe('2.5vw')
    expect(headerBar?.classList.contains('border-b-2')).toBe(false)
    expect(headerBar?.classList.contains('bg-[#1d1d1f]')).toBe(false)
    expect(headerBar?.classList.contains('text-[#f5f5f7]')).toBe(true)

    for (const [index, column] of columns.entries()) {
      expect(column.classList.contains('min-h-0')).toBe(true)
      expect(column.classList.contains('justify-between')).toBe(true)
      const header = headerColumns[index] as HTMLElement | undefined
      expect(header?.style.gridTemplateColumns).toBe('10vh minmax(0, 1fr) 7vh 7vh 7vh')
      expect(header?.classList.contains('bg-[#1d1d1f]')).toBe(true)
      expect(header?.style.borderRadius).toBe('0.35vh')
      expect(header?.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
      expect(header?.firstElementChild?.textContent).toBe('')
      expect(header?.lastElementChild?.classList.contains('text-center')).toBe(true)

      const rows = Array.from(column.children)
      expect(rows).toHaveLength(6)
      for (const row of rows) {
        expect(row.getAttribute('role')).toBe('listitem')
        expect(row.classList.contains('flex-none')).toBe(true)
        expect(row.classList.contains('flex-1')).toBe(false)
      }
    }
  })
})
