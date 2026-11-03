/**
 * Tests the public event page (/events/<id>) by rendering the real server
 * component with the Payload fetchers mocked:
 * - a miss (unknown, private, past or malformed id) calls notFound()
 * - a hit renders the name, taproom link, calendar link and event JSON-LD
 *   whose url is the page's canonical
 * - DB errors propagate to error.tsx (not caught)
 * - the public summary renders only when set
 * - recurring occurrence ids resolve like one-off ids
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'

class NotFoundSentinel extends Error {
  constructor() {
    super('notFound was called')
  }
}

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new NotFoundSentinel()
  }),
  usePathname: () => '/events/x',
}))

vi.mock('@/components/motion', () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/lib/utils/payload-api', () => ({
  getPublicEventById: vi.fn(),
  getAllLocations: vi.fn(async () => []),
  fetchGlobal: vi.fn(),
}))

vi.mock('@/lib/utils/site-seo', () => ({
  getSiteSeo: vi.fn(async () => ({})),
}))

import EventPage, { generateMetadata } from '@/src/app/(frontend)/events/[id]/page'
import { getAllLocations, getPublicEventById } from '@/lib/utils/payload-api'

const ONE_OFF_ID = '6650f1a2b3c4d5e6f7a8b9c0'
const RECURRING_ID = 'recurring-6650f1a2b3c4d5e6f7a8b9c1-2026-11-07'

const location = {
  id: 'loc-1',
  name: 'Lawrenceville',
  slug: 'lawrenceville',
  address: { street: '5247 Butler St', city: 'Pittsburgh', state: 'PA', zip: '15201' },
}

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: ONE_OFF_ID,
    visibility: 'public',
    organizer: 'Anniversary Party',
    location,
    date: '2026-11-07T00:00:00.000Z',
    startTime: '6pm',
    endTime: '10pm',
    site: 'https://www.eventbrite.com/e/123',
    updatedAt: '2026-10-01T00:00:00.000Z',
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }
}

const lookup = () => getPublicEventById as ReturnType<typeof vi.fn>

async function renderPage(id: string) {
  const tree = (await EventPage({ params: Promise.resolve({ id }) })) as ReactElement
  return render(tree)
}

function eventJsonLd(container: HTMLElement) {
  const blocks = [...container.querySelectorAll('script[type="application/ld+json"]')].map((node) =>
    JSON.parse(node.textContent ?? '{}'),
  )
  return blocks.find((block) => block['@type'] === 'Event')
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getAllLocations as ReturnType<typeof vi.fn>).mockResolvedValue([location])
})
afterEach(cleanup)

describe('EventPage', () => {
  it('calls notFound() when the lookup misses', async () => {
    lookup().mockResolvedValue(null)
    await expect(EventPage({ params: Promise.resolve({ id: 'nope' }) })).rejects.toThrow(
      NotFoundSentinel,
    )
    expect(lookup()).toHaveBeenCalledWith('nope')
  })

  it('renders the name, taproom link, calendar link and canonical event JSON-LD', async () => {
    lookup().mockResolvedValue(event())
    const { container } = await renderPage(ONE_OFF_ID)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Anniversary Party')
    expect(screen.getByRole('link', { name: 'Lawrenceville' }).getAttribute('href')).toBe(
      '/lawrenceville',
    )
    expect(screen.getByText('5247 Butler St, Pittsburgh, PA 15201')).toBeTruthy()
    expect(container.textContent).toContain('6pm–10pm')
    expect(screen.getByRole('link', { name: /Add .* to calendar/ }).getAttribute('href')).toBe(
      `/events/${ONE_OFF_ID}/calendar.ics`,
    )
    expect(screen.getByRole('link', { name: /Tickets/ }).getAttribute('href')).toBe(
      'https://www.eventbrite.com/e/123',
    )
    expect(screen.getByRole('link', { name: /All events/ }).getAttribute('href')).toBe('/events')

    expect(eventJsonLd(container)?.url).toBe(`https://lolev.beer/events/${ONE_OFF_ID}`)
  })

  it('labels a non-ticket site as Website', async () => {
    lookup().mockResolvedValue(event({ site: 'https://band.example.com' }))
    await renderPage(ONE_OFF_ID)
    expect(screen.getByRole('link', { name: /Website/ }).getAttribute('href')).toBe(
      'https://band.example.com/',
    )
    expect(screen.queryByRole('link', { name: /Tickets/ })).toBeNull()
  })

  it('propagates DB errors instead of rendering a 404', async () => {
    const dbError = new Error('Database connection failed')
    lookup().mockRejectedValue(dbError)
    await expect(EventPage({ params: Promise.resolve({ id: ONE_OFF_ID }) })).rejects.toThrow(
      dbError,
    )
  })

  it('renders the summary only when one is set', async () => {
    lookup().mockResolvedValue(event({ summary: 'Six years of Lolev, with a cask lineup.' }))
    await renderPage(ONE_OFF_ID)
    expect(screen.getByText('Six years of Lolev, with a cask lineup.')).toBeTruthy()
    cleanup()

    lookup().mockResolvedValue(event({ summary: null }))
    const { container } = await renderPage(ONE_OFF_ID)
    expect(container.textContent).not.toContain('Six years')
  })

  it('resolves a recurring occurrence id', async () => {
    lookup().mockResolvedValue(event({ id: RECURRING_ID, organizer: 'Trivia', site: null }))
    const { container } = await renderPage(RECURRING_ID)
    expect(lookup()).toHaveBeenCalledWith(RECURRING_ID)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Trivia')
    expect(screen.getByRole('link', { name: /Add .* to calendar/ }).getAttribute('href')).toBe(
      `/events/${RECURRING_ID}/calendar.ics`,
    )
    expect(eventJsonLd(container)?.url).toBe(`https://lolev.beer/events/${RECURRING_ID}`)
  })
})

describe('generateMetadata', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns minimal metadata for a miss', async () => {
    lookup().mockResolvedValue(null)
    const metadata = await generateMetadata({ params: Promise.resolve({ id: 'nope' }) })
    expect(metadata.title).toBe('Event Not Found')
    expect(metadata.description).toBeUndefined()
  })

  it('uses the summary, the canonical and the event card', async () => {
    lookup().mockResolvedValue(event({ summary: 'Six years of Lolev.' }))
    const metadata = await generateMetadata({ params: Promise.resolve({ id: ONE_OFF_ID }) })
    expect(metadata.description).toBe('Six years of Lolev.')
    expect(metadata.alternates?.canonical).toContain(`/events/${ONE_OFF_ID}`)
    expect(JSON.stringify(metadata.openGraph?.images)).toContain(`/og/event/${ONE_OFF_ID}`)
  })

  it('falls back to "<name> at <taproom> on <date>"', async () => {
    lookup().mockResolvedValue(event())
    const metadata = await generateMetadata({ params: Promise.resolve({ id: ONE_OFF_ID }) })
    expect(metadata.description).toMatch(/^Anniversary Party at Lawrenceville on .*November 7/)
  })

  it('propagates DB errors', async () => {
    const dbError = new Error('Database connection failed')
    lookup().mockRejectedValue(dbError)
    await expect(generateMetadata({ params: Promise.resolve({ id: ONE_OFF_ID }) })).rejects.toThrow(
      dbError,
    )
  })
})
