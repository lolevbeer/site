/**
 * FAQ closer names the selected taproom and shows that location's phone.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const locationState = vi.hoisted(() => ({
  currentLocation: 'lawrenceville',
  isClient: true,
}))

vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({
    currentLocation: locationState.currentLocation,
    isClient: locationState.isClient,
    locations: [
      {
        id: '1',
        slug: 'lawrenceville',
        name: 'Lawrenceville',
        address: {
          street: '5247 Butler Street',
          city: 'Pittsburgh',
          state: 'PA',
          zip: '15201',
        },
        basicInfo: { phone: '(412) 336-8965' },
      },
      {
        id: '2',
        slug: 'zelienople',
        name: 'Zelienople',
        address: {
          street: '111 South Main Street',
          city: 'Zelienople',
          state: 'PA',
          zip: '16063',
        },
        basicInfo: { phone: '(724) 609-5100' },
      },
    ],
  }),
}))

import { FaqContactSection } from '@/components/faq/faq-contact'

afterEach(() => {
  locationState.currentLocation = 'lawrenceville'
  locationState.isClient = true
  cleanup()
})

describe('FaqContactSection', () => {
  it('names the selected taproom and uses that location’s phone', () => {
    render(createElement(FaqContactSection))

    expect(
      screen.getByText(/call Lawrenceville at/i),
    ).toBeTruthy()
    expect(
      screen.getAllByRole('link', { name: '(412) 336-8965' }).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText(/call Zelienople at/i)).toBeNull()

    const selected = screen.getByRole('link', { name: 'Lawrenceville' }).closest('address')
    expect(selected?.getAttribute('aria-current')).toBe('true')
  })

  it('updates the named taproom and phone when the selected location changes', () => {
    const { rerender } = render(createElement(FaqContactSection))

    locationState.currentLocation = 'zelienople'
    rerender(createElement(FaqContactSection))

    expect(screen.getByText(/call Zelienople at/i)).toBeTruthy()
    expect(
      screen.getAllByRole('link', { name: '(724) 609-5100' }).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText(/call Lawrenceville at/i)).toBeNull()

    const selected = screen.getByRole('link', { name: 'Zelienople' }).closest('address')
    expect(selected?.getAttribute('aria-current')).toBe('true')
  })

  it('still lists every taproom phone so the unselected number is available', () => {
    render(createElement(FaqContactSection))

    expect(screen.getAllByRole('link', { name: '(412) 336-8965' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: '(724) 609-5100' })).toBeTruthy()
  })

  it('does not name a taproom before the client has resolved the selection', () => {
    locationState.isClient = false
    render(createElement(FaqContactSection))

    expect(screen.queryByText(/call Lawrenceville at/i)).toBeNull()
    expect(screen.queryByText(/call Zelienople at/i)).toBeNull()
    expect(screen.getByRole('link', { name: 'info@lolev.beer' })).toBeTruthy()
  })
})
