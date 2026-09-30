/**
 * LiveMenu renders the right board for each menu type and shows the realtime
 * bolt inside the themed frame only while the display is connected to Ably.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Menu } from '@/src/payload-types'

const stream = vi.hoisted(() => ({
  value: { menu: null, theme: 'light', realtime: false, pushCount: 0 } as {
    menu: unknown
    theme: 'light' | 'dark'
    realtime: boolean
    pushCount: number
  },
}))
vi.mock('@/lib/hooks/use-menu-stream', () => ({ useMenuStream: () => stream.value }))
vi.mock('@/components/home/featured-menu', () => ({
  FeaturedBeers: () => <div data-testid="featured-beers" />,
  FeaturedCans: ({ labelVideos }: { labelVideos?: boolean }) => (
    <div data-testid="featured-cans" data-label-videos={String(labelVideos)} />
  ),
}))

import { LiveMenu } from '@/components/menu/live-menu'

const menu = (type: string, extra: Partial<Menu> = {}) =>
  ({ id: 'm1', url: 'l-draft', type, items: [], ...extra }) as unknown as Menu

beforeEach(() => {
  stream.value = { menu: null, theme: 'light', realtime: false, pushCount: 0 }
})
afterEach(cleanup)

describe('LiveMenu boards', () => {
  it.each([
    ['draft', 'featured-beers'],
    ['other', 'featured-beers'],
    ['cans', 'featured-cans'],
  ])('renders the %s menu with the %s board', (type, testId) => {
    render(<LiveMenu menuUrl="l-draft" initialMenu={menu(type)} />)
    expect(screen.getByTestId(testId)).toBeTruthy()
  })

  it('passes animateCans through to the cans labels, defaulting to on', () => {
    const { rerender } = render(<LiveMenu menuUrl="c" initialMenu={menu('cans')} />)
    expect(screen.getByTestId('featured-cans').getAttribute('data-label-videos')).toBe('true')
    rerender(<LiveMenu menuUrl="c" initialMenu={menu('cans', { animateCans: false })} />)
    expect(screen.getByTestId('featured-cans').getAttribute('data-label-videos')).toBe('false')
  })

  it('renders nothing for an unknown menu type, even when connected', () => {
    stream.value = { ...stream.value, realtime: true }
    const { container } = render(<LiveMenu menuUrl="x" initialMenu={menu('mystery')} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('LiveMenu realtime indicator', () => {
  it('shows no bolt while the display is polling only', () => {
    render(<LiveMenu menuUrl="l-draft" initialMenu={menu('draft')} />)
    expect(screen.queryByRole('img', { name: 'Live updates connected' })).toBeNull()
  })

  it.each(['draft', 'other', 'cans'])(
    'shows the bolt in the themed frame for a connected %s board',
    (type) => {
      stream.value = { ...stream.value, realtime: true }
      render(<LiveMenu menuUrl="l-draft" initialMenu={menu(type)} />)
      const bolt = screen.getByRole('img', { name: 'Live updates connected' })
      const board = screen.getByTestId(type === 'cans' ? 'featured-cans' : 'featured-beers')
      // Same frame as the board, so it inherits the theme's CSS variables.
      expect(bolt.parentElement).toBe(board.parentElement)
    },
  )

  it('restarts the pulse when a push arrives', () => {
    stream.value = { ...stream.value, realtime: true, pushCount: 0 }
    const { rerender } = render(<LiveMenu menuUrl="l-draft" initialMenu={menu('draft')} />)
    const before = screen.getByRole('img').querySelector('svg')
    stream.value = { ...stream.value, pushCount: 1 }
    rerender(<LiveMenu menuUrl="l-draft" initialMenu={menu('draft')} />)
    expect(screen.getByRole('img').querySelector('svg')).not.toBe(before)
  })
})
