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
  it('links to the taproom page and shows only on portrait touch screens', () => {
    render(<TapListBanner locationSlug="lawrenceville" />)
    const link = screen.getByRole('link', { name: 'See the full tap list' })
    expect(link.getAttribute('href')).toBe('/lawrenceville')
    const banner = link.closest('[data-tap-list-banner]')!
    expect(banner.className).toContain('hidden')
    // Portrait alone would also catch a vertically mounted TV or a tall
    // desktop window; a coarse pointer limits it to phones and tablets.
    expect(banner.className).toContain('portrait:pointer-coarse:flex')
    expect(banner.className).not.toMatch(/(^| )portrait:flex/)
  })

  it('takes its link text from the board', () => {
    render(<TapListBanner locationSlug="zelienople" label="Open the taproom page" />)
    expect(screen.getByRole('link', { name: 'Open the taproom page' }).getAttribute('href')).toBe(
      '/zelienople',
    )
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

describe('LiveEvents taproom banner', () => {
  it('links the taproom page for the location the page resolved', () => {
    render(<LiveEvents location="zelienople" initialEvents={[]} initialLocationName="Zelienople" />)
    expect(screen.getByRole('link', { name: 'Open the taproom page' }).getAttribute('href')).toBe(
      '/zelienople',
    )
  })
})

describe('board frame', () => {
  it('uses the dynamic viewport height so the phone banner is not under the toolbar', () => {
    render(<LiveEvents location="zelienople" initialEvents={[]} initialLocationName="Zelienople" />)
    const frame = screen.getByRole('link', { name: 'Open the taproom page' }).closest('.h-dvh')
    expect(frame).not.toBeNull()
    expect(frame?.className).not.toContain('h-screen')
  })
})
