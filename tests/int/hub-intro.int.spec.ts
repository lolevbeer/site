/**
 * The CMS "Intro text" for Events and Food renders under the heading, and blank renders nothing.
 */
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({ currentLocation: 'all', locations: [], cycleLocation: vi.fn() }),
}))
vi.mock('@/components/ui/page-breadcrumbs', () => ({ PageBreadcrumbs: () => null }))

import { EventsPageClient } from '@/src/app/(frontend)/events/events-page-client'
import { FoodPageClient } from '@/src/app/(frontend)/food/food-page-client'

afterEach(cleanup)

describe.each([
  ['Events', (intro?: string) => createElement(EventsPageClient, { initialEvents: [], intro })],
  ['Food', (intro?: string) => createElement(FoodPageClient, { initialSchedules: [], intro })],
])('%s page intro', (heading, ui) => {
  it('shows the intro under the heading', () => {
    render(ui('Trivia, live music, and more.'))
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy()
    expect(screen.getByText('Trivia, live music, and more.')).toBeTruthy()
  })

  it('renders no intro paragraph when blank', () => {
    const { container } = render(ui(undefined))
    expect(container.querySelector('h1 + p')).toBeNull()
  })
})
