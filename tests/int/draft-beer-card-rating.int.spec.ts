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
  description: 'A test beer.',
  glutenFree: false,
  image: false,
  untappdRating: 4.25,
  hops: 'Citra',
  tap: 7,
  pricing: { draftPrice: 7 },
  availability: { hideFromSite: false },
}

function renderFullscreenBeer(overrides: Partial<Beer> = {}) {
  return render(
    createElement(DraftBeerCard, {
      beer: { ...beer, ...overrides },
      showTapAndPrice: true,
      showRating: true,
      showLocation: false,
    }),
  )
}

afterEach(cleanup)

describe('DraftBeerCard fullscreen rating layout', () => {
  it('centers the tap inside the glass and places a larger rating stack beside it', () => {
    const { container } = renderFullscreenBeer()

    const rating = container.querySelector('.text-amber-500.flex-col')
    const tapRail = rating?.parentElement
    const tapNumber = tapRail?.querySelector('.tabular-nums')
    const glass = tapNumber?.parentElement
    const untappdIcon = rating?.firstElementChild as SVGElement | undefined
    const cardWrapper = container.firstElementChild
    const card = cardWrapper?.firstElementChild
    const row = card?.firstElementChild as HTMLElement | undefined

    expect(rating).not.toBeNull()
    expect(cardWrapper?.classList.contains('h-full')).toBe(false)
    expect(card?.classList.contains('h-full')).toBe(false)
    expect(row?.classList.contains('h-full')).toBe(false)
    expect(row?.style.paddingBlock).toBe('0.5vh')
    expect(rating?.classList.contains('flex')).toBe(true)
    expect(rating?.classList.contains('items-center')).toBe(true)
    expect(rating?.textContent).toBe('4.25')
    expect(untappdIcon?.tagName).toBe('svg')
    expect(untappdIcon?.style.height).toBe('2.4vh')
    expect(untappdIcon?.style.width).toBe('2.4vh')
    expect(rating?.lastElementChild?.textContent).toBe('4.25')
    expect(tapRail?.classList.contains('self-center')).toBe(true)
    expect((tapRail as HTMLElement | undefined)?.style.gridRow).toBe('1 / span 2')
    expect(row?.style.gridTemplateColumns).toBe('10vh minmax(0, 1fr) 7vh 7vh 7vh')
    expect((glass as HTMLElement | undefined)?.style.height).toBe('7vh')
    expect((glass as HTMLElement | undefined)?.style.width).toBe('5vh')
    expect(tapNumber?.classList.contains('absolute')).toBe(true)
    expect(tapNumber?.classList.contains('inset-0')).toBe(true)
    expect(tapNumber?.classList.contains('items-center')).toBe(true)
    expect(tapNumber?.classList.contains('justify-center')).toBe(true)
    expect(tapRail?.textContent).toBe('74.25')

    const beerInfo = tapRail?.nextElementSibling
    expect(beerInfo?.textContent).not.toContain('4.25')
  })

  it('optically centers a stein body beneath the tap number', () => {
    const { container } = renderFullscreenBeer({ glass: GlassType.STEIN })

    const tapNumber = container.querySelector('.tabular-nums')
    const glassIcon = tapNumber?.parentElement?.querySelector('svg')
    const card = container.firstElementChild?.firstElementChild

    expect(glassIcon?.classList.contains('-translate-x-[0.8vh]')).toBe(true)
    expect(glassIcon?.classList.contains('scale-[1.08]')).toBe(true)
    expect(card?.classList.contains('overflow-visible')).toBe(true)
    expect(card?.classList.contains('overflow-hidden')).toBe(false)
  })

  it('allows the description and hops to wrap onto additional lines', () => {
    const { container } = renderFullscreenBeer()

    const description = Array.from(container.querySelectorAll('div')).find(
      (element) => element.textContent === beer.description,
    )
    const hopsLabel = Array.from(container.querySelectorAll('span')).find(
      (element) => element.textContent === 'Hops',
    )
    const hops = hopsLabel?.parentElement

    expect(description?.classList.contains('line-clamp-1')).toBe(false)
    expect(description?.classList.contains('whitespace-normal')).toBe(true)
    expect(description?.classList.contains('break-words')).toBe(true)
    expect((description?.parentElement as HTMLElement | undefined)?.style.gridColumn).toBe('2 / -1')
    expect(hops?.classList.contains('truncate')).toBe(false)
    expect(hops?.classList.contains('whitespace-normal')).toBe(true)
    expect(hops?.classList.contains('break-words')).toBe(true)
    expect(hopsLabel?.classList.contains('text-amber-500')).toBe(false)
    expect(hopsLabel?.classList.contains('text-foreground-muted')).toBe(true)
    expect(hopsLabel?.classList.contains('uppercase')).toBe(true)
    expect((hopsLabel as HTMLElement | undefined)?.style.marginRight).toBe('0.6vh')
  })

  it('wraps complete title metadata and keeps status badges out of the price columns', () => {
    const decoratedBeer: Beer = {
      ...beer,
      name: 'Double Lupula: Freestyle Edition',
      collab: true,
      collabBrewery: 'Azvex Brewing Company',
    }
    const { container } = renderFullscreenBeer(decoratedBeer)

    const heading = Array.from(container.querySelectorAll('h3')).find(
      (element) => element.textContent === decoratedBeer.name,
    )
    const titleMetadata = heading?.parentElement
    const collabBadge = Array.from(container.querySelectorAll('div')).find(
      (element) => element.textContent === 'Collab · Azvex Brewing Company',
    )

    expect(heading?.classList.contains('truncate')).toBe(false)
    expect(heading?.classList.contains('break-words')).toBe(true)
    expect(titleMetadata?.classList.contains('flex-wrap')).toBe(true)
    expect(collabBadge?.parentElement).not.toBe(titleMetadata)
    expect(collabBadge?.parentElement?.textContent).toContain(decoratedBeer.description)
    expect(collabBadge?.classList.contains('absolute')).toBe(false)
    expect((collabBadge as HTMLElement | undefined)?.style.fontSize).toBe('1.45vh')
  })

  it('keeps the generic Collab label for existing beers without a brewery name', () => {
    const { container } = renderFullscreenBeer({ collab: true })

    expect(
      Array.from(container.querySelectorAll('div')).some(
        (element) => element.textContent === 'Collab',
      ),
    ).toBe(true)
  })
})
