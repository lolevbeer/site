/**
 * Header location switcher is hidden on taproom landings.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const pathname = vi.hoisted(() => ({ value: '/' }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.value,
}))

vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({
    currentLocation: 'lawrenceville',
    setLocation: vi.fn(),
    isClient: true,
    locations: [
      { id: '1', slug: 'lawrenceville', name: 'Lawrenceville' },
      { id: '2', slug: 'zelienople', name: 'Zelienople' },
    ],
  }),
}))

import { LocationTabs } from '@/components/location/location-tabs'

afterEach(cleanup)

describe('LocationTabs', () => {
  it('renders on the homepage and hides on a taproom landing', () => {
    pathname.value = '/'
    const { rerender } = render(createElement(LocationTabs))
    expect(screen.getByRole('group', { name: 'Choose location' })).toBeTruthy()

    pathname.value = '/lawrenceville'
    rerender(createElement(LocationTabs))
    expect(screen.queryByRole('group', { name: 'Choose location' })).toBeNull()
  })
})
