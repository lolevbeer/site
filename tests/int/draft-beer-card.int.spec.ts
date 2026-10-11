/**
 * DraftBeerCard has two rows. Without `showTapAndPrice` (homepage featured
 * drafts, taproom landings) it is the compact row: name and style only. The
 * `/m` board row adds the glass, tap, description, hops, ABV, and prices; its
 * time-based "Just Released" badge needs a clock from the caller (`now`).
 */
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { DraftBeerCard } from '@/components/beer/draft-beer-card'
import { GlassType, type Beer } from '@/lib/types/beer'

const beer: Beer = {
  variant: 'test-beer',
  name: 'Test Beer',
  type: 'IPA',
  abv: 6.5,
  glass: GlassType.PINT,
  description: 'A juicy hazy IPA.',
  glutenFree: false,
  image: false,
  hops: 'Citra',
  tap: 12,
  pricing: { draftPrice: 7 },
  availability: { hideFromSite: false },
  createdAt: new Date().toISOString(),
  topBeerDrops: 'https://topbeerdrops.com/test-beer',
}

afterEach(cleanup)

describe('DraftBeerCard compact row', () => {
  it('shows only the name and style, linked to the beer page', () => {
    const { container } = render(createElement(DraftBeerCard, { beer, now: Date.now() }))

    expect(container.textContent).toContain('Test Beer')
    expect(container.textContent).toContain('IPA')
    for (const hidden of ['A juicy hazy IPA.', 'Citra', '6.5%', '$7', 'Just Released']) {
      expect(container.textContent).not.toContain(hidden)
    }
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('a[href="https://topbeerdrops.com/test-beer"]')).toBeNull()
    expect(container.querySelector('a[href="/beer/test-beer"]')).not.toBeNull()
  })
})

describe('DraftBeerCard board row', () => {
  it('shows glass, tap, description, hops, ABV, and price', () => {
    const { container } = render(createElement(DraftBeerCard, { beer, showTapAndPrice: true }))

    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('.tabular-nums.text-primary')?.textContent).toBe('12')
    for (const shown of ['A juicy hazy IPA.', 'Citra', '6.5%', '$7']) {
      expect(container.textContent).toContain(shown)
    }
  })

  it('shows no ABV for a beer without one (menus pass it as "")', () => {
    const noAbv = { ...beer, abv: '' as unknown as number }
    const { container } = render(
      createElement(DraftBeerCard, { beer: noAbv, showTapAndPrice: true }),
    )
    expect(container.textContent).not.toContain('%')
  })

  it('shows Just Released only with a clock', () => {
    const withClock = render(
      createElement(DraftBeerCard, { beer, showTapAndPrice: true, now: Date.now() }),
    )
    expect(withClock.container.textContent).toContain('Just Released')
    cleanup()

    const { container } = render(createElement(DraftBeerCard, { beer, showTapAndPrice: true }))
    expect(container.textContent).not.toContain('Just Released')
  })
})
