/**
 * Events tagged `beer-release` in the CMS carry a "Beer release" badge on
 * /events, the home agenda, and taproom landings so a can drop does not read
 * like another trivia night.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventStatus, EventType, type BreweryEvent } from '@/lib/types/event'
import type { PayloadLocation } from '@/lib/types/location'
import { eventBadge } from '@/lib/utils/event-regulars'

vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => ({
    locations: [{ id: 'lawrenceville', slug: 'lawrenceville', name: 'Lawrenceville' }],
    currentLocation: 'lawrenceville',
  }),
}))
vi.mock('@/components/ui/page-breadcrumbs', () => ({ PageBreadcrumbs: () => null }))
vi.mock('@/components/beer/draft-beer-card', () => ({ DraftBeerCard: () => null }))
vi.mock('@/components/beer/beer-card', () => ({ BeerCard: () => null }))
vi.mock('@/lib/utils/formatters', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/utils/formatters')>('@/lib/utils/formatters')
  return { ...actual, isTodayOrFuture: () => true }
})

import { EventsPageClient } from '@/src/app/(frontend)/events/events-page-client'
import { LocationLanding } from '@/components/location/location-landing'

afterEach(cleanup)

function ev(id: string, title: string, tags?: BreweryEvent['tags']): BreweryEvent {
  return {
    id,
    title,
    date: '2026-10-15',
    time: '19:00',
    vendor: title,
    type: EventType.SPECIAL_EVENT,
    status: EventStatus.SCHEDULED,
    location: 'lawrenceville',
    tags,
  }
}

describe('EventsPageClient beer release badge', () => {
  it('badges only events tagged beer-release', () => {
    const { container } = render(
      <EventsPageClient
        initialEvents={[
          ev('release', 'Mosaic can drop', ['beer-release']),
          ev('trivia', 'Trivia night', ['puzzle']),
        ]}
      />,
    )
    expect(screen.getAllByText('Beer release')).toHaveLength(1)
    expect(container.querySelector('#event-release')?.textContent).toContain('Beer release')
    expect(container.querySelector('#event-trivia')?.textContent).not.toContain('Beer release')
  })
})

describe('eventBadge', () => {
  it('labels only beer-release tags', () => {
    expect(eventBadge(['music', 'beer-release'])).toBe('Beer release')
    expect(eventBadge(['puzzle'])).toBeUndefined()
    expect(eventBadge(null)).toBeUndefined()
  })
})

describe('taproom agenda beer release badge', () => {
  it('badges a tagged event on the taproom landing too', () => {
    render(
      <LocationLanding
        location={{ id: 'l', slug: 'zelienople', name: 'Zelienople' } as PayloadLocation}
        weeklyHours={[]}
        draftBeers={[]}
        canBeers={[]}
        events={[
          {
            id: 'r',
            organizer: 'Mosaic can drop',
            date: '2026-10-15',
            tags: ['beer-release'],
          } as never,
        ]}
        food={[]}
        otherLocations={[]}
      />,
    )
    expect(screen.getByText('Beer release')).toBeTruthy()
  })
})
