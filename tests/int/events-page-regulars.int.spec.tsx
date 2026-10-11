/**
 * /events lists one-offs by date and folds weekly regulars into one
 * "Regulars" block, keeping every collapsed occurrence's anchor so the Event
 * JSON-LD links (#event-<id>) still land.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventStatus, EventType, type BreweryEvent } from '@/lib/types/event'

vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({
    locations: [{ id: 'lawrenceville', slug: 'lawrenceville', name: 'Lawrenceville' }],
    currentLocation: 'lawrenceville',
  }),
}))
vi.mock('@/components/ui/page-breadcrumbs', () => ({ PageBreadcrumbs: () => null }))
vi.mock('@/lib/utils/formatters', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils/formatters')>(
    '@/lib/utils/formatters',
  )
  return { ...actual, isTodayOrFuture: () => true }
})

import { EventsPageClient } from '@/src/app/(frontend)/events/events-page-client'

afterEach(cleanup)

function ev(id: string, date: string, title: string): BreweryEvent {
  return {
    id,
    title,
    date,
    time: '19:00',
    vendor: title,
    type: id.startsWith('recurring-') ? EventType.RECURRING : EventType.SPECIAL_EVENT,
    status: EventStatus.SCHEDULED,
    location: 'lawrenceville',
  }
}

describe('EventsPageClient regulars', () => {
  it('shows one-offs in the dated list and weekly trivia once under Regulars', () => {
    const { container } = render(
      createElement(EventsPageClient, {
        initialEvents: [
          ev('recurring-t-2026-10-14', '2026-10-14', 'Trivia'),
          ev('release', '2026-10-15', 'Mosaic can release'),
          ev('recurring-t-2026-10-21', '2026-10-21', 'Trivia'),
        ],
      }),
    )
    expect(screen.getByRole('heading', { name: 'Regulars' })).toBeTruthy()
    expect(screen.getAllByText(/Trivia/)).toHaveLength(1)
    expect(screen.getByText('Wednesdays 7pm · Trivia')).toBeTruthy()
    expect(screen.getByText('Mosaic can release')).toBeTruthy()
    expect(container.querySelector('#event-release')).not.toBeNull()
    expect(container.querySelector('#event-recurring-t-2026-10-14')).not.toBeNull()
    expect(container.querySelector('#event-recurring-t-2026-10-21')).not.toBeNull()
  })
})
