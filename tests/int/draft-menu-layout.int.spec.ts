/**
 * Draft menu rendering: fullscreen board layout, the homepage list, and the
 * automatic "Just Released" badge (beers created in the last 7 days).
 */
import { act, cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeaturedBeers } from '@/components/home/featured-menu'
import { MS_PER_DAY } from '@/lib/utils/date'
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

function beerItem(slug: string, overrides: Record<string, unknown> = {}) {
  return {
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
        createdAt: '2020-01-01T00:00:00.000Z',
        ...overrides,
      },
    },
  }
}

const collab = { collab: true, collabBrewery: 'Azvex Brewing Company' }

function makeDraftMenu(
  items = Array.from({ length: 12 }, (_, index) =>
    beerItem(`beer-${index + 1}`, index === 0 ? collab : {}),
  ),
): Menu {
  return {
    id: 'draft-menu',
    name: 'Draft Beer',
    type: 'draft',
    location: { id: 'loc-1', slug: 'lawrenceville', name: 'Lawrenceville' },
    items,
  } as unknown as Menu
}

function rowFor(container: HTMLElement, name: string): HTMLElement {
  const rows = Array.from(container.querySelectorAll<HTMLElement>('[role="listitem"]'))
  const row = rows.find((r) => r.textContent?.includes(name))
  if (!row) throw new Error(`No menu row for ${name}`)
  return row
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

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

  it('renders the homepage draft list as a single centered column', () => {
    const { container } = render(createElement(FeaturedBeers, { menus: [makeDraftMenu()] }))
    const section = container.querySelector('#draft')
    const list = section?.querySelector('ul')

    expect(list?.className).toContain('max-w-2xl')
    expect(list?.className).toContain('mx-auto')
    expect(list?.className).not.toContain('grid-cols-2')
    expect(section?.querySelector('.lg\\:grid-cols-2')).toBeNull()
  })
})

describe('menu "Just Released" badge', () => {
  const createdDaysAgo = (days: number) => new Date(Date.now() - days * MS_PER_DAY).toISOString()

  it('marks only beers created in the last 7 days, ignoring any stored manual flag', () => {
    const menu = makeDraftMenu([
      beerItem('Fresh Pale', { createdAt: createdDaysAgo(2) }),
      beerItem('Old Stout', { createdAt: createdDaysAgo(90), justReleased: true }),
    ])

    const { container } = render(createElement(FeaturedBeers, { menu }))

    expect(rowFor(container, 'Fresh Pale').textContent).toContain('Just Released')
    expect(rowFor(container, 'Old Stout').textContent).not.toContain('Just Released')
  })

  it('leaves the time-based badge out of server HTML, so hydration always matches', () => {
    const menu = makeDraftMenu([beerItem('Fresh Pale', { createdAt: createdDaysAgo(2) })])

    expect(renderToString(createElement(FeaturedBeers, { menu }))).not.toContain('Just Released')
  })

  it('drops the badge on a display left running past the 7-day mark', () => {
    vi.useFakeTimers({
      toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    vi.setSystemTime(Date.parse('2026-09-27T12:00:00.000Z'))
    const menu = makeDraftMenu([beerItem('Almost Week', { createdAt: createdDaysAgo(6.95) })])

    const { container } = render(createElement(FeaturedBeers, { menu }))
    expect(rowFor(container, 'Almost Week').textContent).toContain('Just Released')

    act(() => {
      vi.advanceTimersByTime(3 * 60 * 60 * 1000)
    })
    expect(rowFor(container, 'Almost Week').textContent).not.toContain('Just Released')
  })
})
