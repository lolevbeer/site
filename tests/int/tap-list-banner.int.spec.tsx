/**
 * TV boards (/m, /e) are sometimes opened on phones. A portrait-only banner
 * points those visitors to the taproom page; landscape TVs never show it.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Menu } from '@/src/payload-types'

vi.mock('@/lib/hooks/use-menu-stream', () => ({
  useMenuStream: (_url: string, initialMenu: Menu) => ({
    menu: initialMenu,
    theme: 'light',
    realtime: false,
    pushCount: 0,
  }),
}))
vi.mock('@/lib/hooks/use-events-stream', () => ({
  useEventsStream: (_location: string, events: unknown[], locationName: string) => ({
    events,
    locationName,
    theme: 'light',
  }),
}))
vi.mock('@/components/home/featured-menu', () => ({
  FeaturedBeers: () => <div data-testid="featured-beers" />,
  FeaturedCans: () => <div data-testid="featured-cans" />,
}))

import { LiveMenu } from '@/components/menu/live-menu'
import { LiveEvents } from '@/components/events/live-events'
import { TapListBanner } from '@/components/ui/tap-list-banner'

afterEach(cleanup)

describe('TapListBanner', () => {
  it('links to the taproom page and is hidden outside portrait', () => {
    render(<TapListBanner locationSlug="lawrenceville" />)
    const link = screen.getByRole('link', { name: 'See the full tap list' })
    expect(link.getAttribute('href')).toBe('/lawrenceville')
    const banner = link.closest('[data-tap-list-banner]')!
    expect(banner.className).toContain('hidden')
    expect(banner.className).toContain('portrait:flex')
  })
})

describe('LiveMenu tap list banner', () => {
  it('points at the menu location', () => {
    const menu = {
      id: 'm1',
      url: 'lawrenceville-draft',
      type: 'draft',
      items: [],
      location: { id: 'l1', slug: 'lawrenceville', name: 'Lawrenceville' },
    } as unknown as Menu
    render(<LiveMenu menuUrl="lawrenceville-draft" initialMenu={menu} />)
    expect(screen.getByRole('link', { name: 'See the full tap list' }).getAttribute('href')).toBe(
      '/lawrenceville',
    )
  })

  it('omits the banner when the location is not populated', () => {
    const menu = { id: 'm1', url: 'x', type: 'draft', items: [], location: 'l1' } as unknown as Menu
    render(<LiveMenu menuUrl="x" initialMenu={menu} />)
    expect(screen.queryByRole('link', { name: 'See the full tap list' })).toBeNull()
  })
})

describe('LiveEvents tap list banner', () => {
  it('points at the board location', () => {
    render(<LiveEvents location="zelienople" initialEvents={[]} initialLocationName="Zelienople" />)
    expect(screen.getByRole('link', { name: 'See the full tap list' }).getAttribute('href')).toBe(
      '/zelienople',
    )
  })
})
