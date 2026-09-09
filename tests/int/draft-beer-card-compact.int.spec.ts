/**
 * Compact DraftBeerCard is the taproom-landing row: name, style, and glass,
 * without description, hops, or ABV.
 */
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DraftBeerCard } from '@/components/beer/draft-beer-card'
import { GlassType, type Beer } from '@/lib/types/beer'

vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({ currentLocation: 'lawrenceville' }),
}))

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
  tap: 7,
  pricing: { draftPrice: 7 },
  availability: { hideFromSite: false },
}

afterEach(cleanup)

describe('DraftBeerCard compact layout', () => {
  it('hides description, hops, and ABV while keeping the name and style', () => {
    const { container } = render(
      createElement(DraftBeerCard, { beer, compact: true, showLocation: false }),
    )

    expect(container.textContent).toContain('Test Beer')
    expect(container.textContent).toContain('IPA')
    expect(container.textContent).not.toContain('A juicy hazy IPA.')
    expect(container.textContent).not.toContain('Hops')
    expect(container.textContent).not.toContain('Citra')
    expect(container.textContent).not.toContain('6.5%')
  })

  it('still shows description, hops, and ABV in the standard homepage row', () => {
    const { container } = render(createElement(DraftBeerCard, { beer, showLocation: false }))

    expect(container.textContent).toContain('A juicy hazy IPA.')
    expect(container.textContent).toContain('Citra')
    expect(container.textContent).toContain('6.5%')
  })

  it('still shows a Just Released badge when compact', () => {
    const { container } = render(
      createElement(DraftBeerCard, {
        beer: { ...beer, isJustReleased: true },
        compact: true,
        showLocation: false,
      }),
    )

    expect(container.textContent).toContain('Just Released')
  })

  it('hides the glass icon on public rows and keeps it on fullscreen menus', () => {
    const { container: publicRow } = render(
      createElement(DraftBeerCard, { beer, showLocation: false }),
    )
    const { container: board, unmount } = render(
      createElement(DraftBeerCard, { beer, showTapAndPrice: true, showLocation: false }),
    )

    expect(publicRow.querySelector('svg')).toBeNull()
    expect(board.querySelector('svg')).not.toBeNull()
    unmount()
  })

  it('hides Top Beer Drops and can omit the just-released badge', () => {
    const { container } = render(
      createElement(DraftBeerCard, {
        beer: {
          ...beer,
          isJustReleased: true,
          topBeerDrops: 'https://topbeerdrops.com/test-beer',
        },
        compact: true,
        showJustReleased: false,
        showLocation: false,
      }),
    )

    expect(container.textContent).not.toContain('Just Released')
    expect(container.querySelector('a[href="https://topbeerdrops.com/test-beer"]')).toBeNull()
  })
})
