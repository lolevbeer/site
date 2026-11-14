/**
 * /events lists one-offs by date and folds weekly regulars into one
 * "Regulars" block, keeping every collapsed occurrence's anchor so older
 * shared links (#event-<id>) still land.
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
vi.mock('@/src/actions/event-inquiry', () => ({ submitEventInquiry: vi.fn() }))
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
  it('lists Regulars before distant one-offs, so this week is seen first', () => {
    render(
      createElement(EventsPageClient, {
        initialEvents: [
          ev('recurring-t-2026-10-14', '2026-10-14', 'Trivia'),
          ev('recurring-t-2026-10-21', '2026-10-21', 'Trivia'),
          ev('anniversary', '2027-01-15', 'Anniversary party'),
        ],
      }),
    )
    const order = screen
      .getByRole('heading', { name: 'Regulars' })
      .compareDocumentPosition(screen.getByText('Anniversary party'))
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

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

  it('links the Regulars row to its next occurrence page and keeps Add to calendar', () => {
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
      within(row).getByRole('link', { name: 'Wednesdays 7pm · Trivia' }).getAttribute('href'),
    ).toBe('/events/recurring-t-2026-10-14')
    // The non-ticket series site lives on the event page now.
    expect(within(row).queryByRole('link', { name: /opens in a new tab/ })).toBeNull()
    expect(
      within(row)
        .getByRole('link', { name: /^Add .*Trivia to calendar$/ })
        .getAttribute('href'),
    ).toBe('/events/recurring-t-2026-10-14/calendar.ics')
  })

  it('links a one-off row title to its event page', () => {
    render(
      createElement(EventsPageClient, {
        initialEvents: [ev('release', '2026-10-15', 'Mosaic can release')],
      }),
    )
    expect(screen.getByRole('link', { name: 'Mosaic can release' }).getAttribute('href')).toBe(
      '/events/release',
    )
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

  it('ignores a malformed #event- escape instead of throwing', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    window.history.replaceState(null, '', '/events#event-%E0%A4%A')
    expect(() =>
      render(createElement(EventsPageClient, { initialEvents: [ev('law', '2026-10-15', 'Jazz')] })),
    ).not.toThrow()
    expect(screen.getByText('Jazz')).toBeTruthy()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('gives an id-less event a URL-safe anchor', () => {
    const { container } = render(
      createElement(EventsPageClient, {
        initialEvents: [ev('', '2026-10-15', 'Mosaic Can Release!', { id: undefined })],
      }),
    )
    const row = container.querySelector('[id^="event-"]')
    expect(row?.id).toMatch(/^event-[a-z0-9-]+$/)
    // No id means no event page to link to.
    expect(screen.queryByRole('link', { name: 'Mosaic Can Release!' })).toBeNull()
  })
})
