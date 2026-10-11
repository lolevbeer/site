/**
 * /events lists one-offs by date and folds weekly regulars into one
 * "Regulars" block, keeping every collapsed occurrence's anchor so the Event
 * JSON-LD links (#event-<id>) still land.
 */
import { cleanup, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventStatus, EventType, type BreweryEvent } from '@/lib/types/event'

const locationContext = vi.hoisted(() => ({
  locations: [
    { id: 'lawrenceville', slug: 'lawrenceville', name: 'Lawrenceville' },
    { id: 'zelienople', slug: 'zelienople', name: 'Zelienople' },
  ],
  currentLocation: 'lawrenceville',
}))
vi.mock('@/components/location/location-provider', () => ({
  useLocationContext: () => locationContext,
}))
vi.mock('@/components/ui/page-breadcrumbs', () => ({ PageBreadcrumbs: () => null }))
vi.mock('@/lib/utils/formatters', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/utils/formatters')>('@/lib/utils/formatters')
  return { ...actual, isTodayOrFuture: () => true }
})

import { EventsPageClient } from '@/src/app/(frontend)/events/events-page-client'

afterEach(() => {
  cleanup()
  locationContext.currentLocation = 'lawrenceville'
  window.history.replaceState(null, '', '/')
})

function ev(
  id: string,
  date: string,
  title: string,
  overrides: Partial<BreweryEvent> = {},
): BreweryEvent {
  return {
    id,
    title,
    date,
    time: '19:00',
    vendor: title,
    type: id.startsWith('recurring-') ? EventType.RECURRING : EventType.SPECIAL_EVENT,
    status: EventStatus.SCHEDULED,
    location: 'lawrenceville',
    ...overrides,
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

  it('keeps the series site link and Add to calendar in the Regulars row', () => {
    render(
      createElement(EventsPageClient, {
        initialEvents: [
          ev('recurring-t-2026-10-14', '2026-10-14', 'Trivia', {
            site: 'https://trivia.example.com/signup',
          }),
          ev('recurring-t-2026-10-21', '2026-10-21', 'Trivia', {
            site: 'https://trivia.example.com/signup',
          }),
        ],
      }),
    )
    const row = screen.getByText('Wednesdays 7pm · Trivia').closest('li')!
    expect(
      within(row)
        .getByRole('link', { name: /Details/ })
        .getAttribute('href'),
    ).toBe('https://trivia.example.com/signup')
    expect(
      within(row)
        .getByRole('link', { name: /^Add .*Trivia to calendar$/ })
        .getAttribute('href'),
    ).toBe('/events/recurring-t-2026-10-14/calendar.ics')
  })

  it('never renders the CMS description, even when it differs from the title', () => {
    render(
      createElement(EventsPageClient, {
        initialEvents: [
          ev('release', '2026-10-15', 'Mosaic can release', {
            description: 'Staff: tab under Smith',
          }),
        ],
      }),
    )
    expect(screen.queryByText(/Smith/)).toBeNull()
  })

  it('scrolls to the #event-<id> row once the URL taproom filter shows it', () => {
    // SSR renders the default taproom; the ?loc= filter applies after hydration.
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    window.history.replaceState(null, '', '/events?loc=zelienople#event-zel')
    const events = [
      ev('law', '2026-10-15', 'Jazz'),
      ev('zel', '2026-10-16', 'Polka', { location: 'zelienople' }),
    ]
    const { rerender } = render(createElement(EventsPageClient, { initialEvents: events }))
    expect(scrollIntoView).not.toHaveBeenCalled()

    locationContext.currentLocation = 'zelienople'
    rerender(createElement(EventsPageClient, { initialEvents: events }))
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toHaveProperty('id', 'event-zel')

    // Only once: later filter changes do not yank the page back.
    locationContext.currentLocation = 'all'
    rerender(createElement(EventsPageClient, { initialEvents: events }))
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('gives an id-less event a URL-safe anchor', () => {
    const { container } = render(
      createElement(EventsPageClient, {
        initialEvents: [ev('', '2026-10-15', 'Mosaic Can Release!', { id: undefined })],
      }),
    )
    const row = container.querySelector('[id^="event-"]')
    expect(row?.id).toMatch(/^event-[a-z0-9-]+$/)
  })
})
