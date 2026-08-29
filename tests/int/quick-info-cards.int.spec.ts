import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, type AnchorHTMLAttributes } from 'react'
import { QuickInfoCards } from '@/components/home/quick-info-cards'

const { setLocationMock } = vi.hoisted(() => ({ setLocationMock: vi.fn() }))

type MockLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  onNavigate?: () => void
}

vi.mock('next/link', async () => {
  const { createElement: createMockElement } = await import('react')
  return {
    default: ({ onNavigate, ...props }: MockLinkProps) =>
      createMockElement('a', {
        ...props,
        onClick: (event) => {
          event.preventDefault()
          onNavigate?.()
        },
      }),
  }
})
vi.mock('@/components/motion', () => ({ MotionCard: 'div' }))
vi.mock('@/components/ui/segmented-control', () => ({
  SEGMENTED_ITEM_IDLE_CLASS: 'segmented-idle',
  SEGMENTED_ITEM_SELECTED_CLASS: 'segmented-selected',
  SEGMENTED_TROUGH_CLASS: 'segmented-trough',
}))
vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({
    locations: [
      { id: 'lawrenceville', slug: 'lawrenceville', name: 'Lawrenceville' },
      { id: 'zelienople', slug: 'zelienople', name: 'Zelienople' },
    ],
    currentLocation: 'lawrenceville',
    setLocation: setLocationMock,
    isClient: true,
  }),
}))

const props = {
  beerCount: { lawrenceville: 10, zelienople: 12 },
  cansCount: { lawrenceville: 8, zelienople: 9 },
  nextEvent: null,
}

beforeEach(() => setLocationMock.mockClear())
afterEach(cleanup)

describe('QuickInfoCards location navigation', () => {
  it('puts the selected location and section in each count link', () => {
    render(createElement(QuickInfoCards, props))

    expect(
      screen
        .getByRole('link', { name: 'See the 12 beers on tap at Zelienople' })
        .getAttribute('href'),
    ).toBe('/?loc=zelienople#draft')
    expect(
      screen.getByRole('link', { name: 'See the 8 cans at Lawrenceville' }).getAttribute('href'),
    ).toBe('/?loc=lawrenceville#cans')
  })

  it('updates the selected location when Next begins navigation', () => {
    render(createElement(QuickInfoCards, props))
    const link = screen.getByRole('link', { name: 'See the 12 beers on tap at Zelienople' })

    fireEvent.click(link)
    expect(setLocationMock).toHaveBeenCalledOnce()
    expect(setLocationMock).toHaveBeenCalledWith('zelienople')
  })

  it('uses two columns until the xl breakpoint', () => {
    const { container } = render(createElement(QuickInfoCards, props))
    const gridClass = container.firstElementChild?.getAttribute('class')

    expect(gridClass).toContain('md:grid-cols-2')
    expect(gridClass).toContain('xl:grid-cols-3')
    expect(gridClass).not.toContain('md:grid-cols-3')
  })
})
