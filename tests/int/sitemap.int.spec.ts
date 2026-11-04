/**
 * Sitemap must only list public routes that 200, and static lastmod must not
 * be "now" on every request (Google then ignores lastmod site-wide).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/utils/payload-api', () => ({
  getAllBeersFromPayload: vi.fn(),
  getAllLocations: vi.fn(),
  getAllUpcomingEventsFromPayload: vi.fn(),
}))

vi.mock('@/lib/jobs/payload', () => ({
  getActiveJobs: vi.fn(),
}))

vi.mock('@/lib/utils/site-seo', () => ({
  getSiteSeo: vi.fn(async () => ({})),
}))

vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import sitemap from '@/src/app/sitemap'
import { getSiteSeo } from '@/lib/utils/site-seo'
import { getActiveJobs } from '@/lib/jobs/payload'
import {
  getAllBeersFromPayload,
  getAllLocations,
  getAllUpcomingEventsFromPayload,
} from '@/lib/utils/payload-api'

const beers = getAllBeersFromPayload as ReturnType<typeof vi.fn>
const locations = getAllLocations as ReturnType<typeof vi.fn>
const jobs = getActiveJobs as ReturnType<typeof vi.fn>
const events = getAllUpcomingEventsFromPayload as ReturnType<typeof vi.fn>

const ONE_OFF_ID = '6650a1b2c3d4e5f6a7b8c9d0'
const RECURRING_ID = 'recurring-6650a1b2c3d4e5f6a7b8c9d1-2026-11-14'

describe('sitemap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // clearAllMocks keeps implementations, so undo any test's SEO override.
    ;(getSiteSeo as ReturnType<typeof vi.fn>).mockResolvedValue({})
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://lolev.beer')
    beers.mockResolvedValue([
      {
        slug: 'lupula',
        hideFromSite: false,
        createdAt: '2026-09-01T12:00:00.000Z',
        // A staff edit (or a sync that changed the rating) after creation.
        updatedAt: '2026-10-09T03:00:00.000Z',
      },
      {
        slug: 'guest-pour',
        hideFromSite: true,
        updatedAt: '2026-09-02T12:00:00.000Z',
      },
    ])
    locations.mockResolvedValue([
      {
        slug: 'lolev-lawrenceville',
        active: true,
        updatedAt: '2026-09-01T16:29:41.957Z',
      },
      {
        slug: 'lolev-zelienople',
        active: true,
        updatedAt: '2026-09-04T13:16:42.524Z',
      },
    ])
    jobs.mockResolvedValue([
      {
        slug: 'bartender',
        title: 'Bartender',
        postedAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-02T12:00:00Z',
      },
    ])
    // The fetcher already drops private events and past dates, so the mock
    // returns only what /events would list.
    events.mockResolvedValue([
      { id: ONE_OFF_ID, visibility: 'public', updatedAt: '2026-10-20T15:00:00.000Z' },
      { id: RECURRING_ID, visibility: 'public', updatedAt: '2026-10-21T15:00:00.000Z' },
    ])
  })

  it('lists every event /events lists, one-off and recurring, at /events/<id>', async () => {
    const entries = await sitemap()
    // Same fetcher and limit as the /events page, which excludes private events.
    expect(events).toHaveBeenCalledWith(100)
    const eventEntries = entries.filter((e) => e.url.startsWith('https://lolev.beer/events/'))
    expect(eventEntries).toEqual([
      {
        url: `https://lolev.beer/events/${ONE_OFF_ID}`,
        lastModified: new Date('2026-10-20T15:00:00.000Z'),
        changeFrequency: 'weekly',
        priority: 0.6,
      },
      {
        url: `https://lolev.beer/events/${RECURRING_ID}`,
        lastModified: new Date('2026-10-21T15:00:00.000Z'),
        changeFrequency: 'weekly',
        priority: 0.6,
      },
    ])
  })

  it('lists no event pages when the events hub is noindex', async () => {
    ;(getSiteSeo as ReturnType<typeof vi.fn>).mockResolvedValue({
      pages: { events: { noIndex: true } },
    })
    const urls = (await sitemap()).map((e) => e.url)
    expect(urls.filter((url) => url.startsWith('https://lolev.beer/events'))).toEqual([])
  })

  it('keeps the rest of the sitemap when the events fetch fails', async () => {
    events.mockRejectedValue(new Error('db down'))
    const urls = (await sitemap()).map((e) => e.url)
    expect(urls).toContain('https://lolev.beer/events')
    expect(urls).toContain('https://lolev.beer/beer/lupula')
  })

  it('includes location landing pages and visible beer pages', async () => {
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls).toContain('https://lolev.beer/lolev-lawrenceville')
    expect(urls).toContain('https://lolev.beer/lolev-zelienople')
    expect(urls).toContain('https://lolev.beer/beer/lupula')
    expect(urls).not.toContain('https://lolev.beer/beer/guest-pour')
    expect(urls).toContain('https://lolev.beer/jobs/bartender')
    expect(urls).toContain('https://lolev.beer/jobs')
  })

  it('does not stamp every static URL with the current time', async () => {
    const before = Date.now()
    const entries = await sitemap()
    const about = entries.find((e) => e.url === 'https://lolev.beer/about')
    expect(about?.lastModified).toBeInstanceOf(Date)
    const lastmod = (about!.lastModified as Date).getTime()
    expect(lastmod).toBeLessThan(before - 24 * 60 * 60 * 1000)
  })

  it('uses beer updatedAt for beer URLs and the catalog, matching the page dateModified', async () => {
    const entries = await sitemap()
    const lupula = entries.find((e) => e.url === 'https://lolev.beer/beer/lupula')
    expect((lupula?.lastModified as Date).toISOString()).toBe('2026-10-09T03:00:00.000Z')
    const catalog = entries.find((e) => e.url === 'https://lolev.beer/beer')
    expect((catalog?.lastModified as Date).toISOString()).toBe('2026-10-09T03:00:00.000Z')
  })

  it('regenerates hourly instead of staying frozen at build time', async () => {
    const mod = await import('@/src/app/sitemap')
    expect(mod.revalidate).toBe(3600)
  })

  it('omits pages the CMS marks noindex or canonicalizes elsewhere', async () => {
    beers.mockResolvedValue([
      { slug: 'lupula', seo: { noIndex: true }, updatedAt: '2026-09-01T12:00:00.000Z' },
      {
        slug: 'mosaic',
        seo: { canonicalPath: '/beer/lupula' },
        updatedAt: '2026-09-01T12:00:00.000Z',
      },
      {
        slug: 'citra',
        seo: { canonicalPath: '/beer/citra' },
        updatedAt: '2026-09-01T12:00:00.000Z',
      },
    ])
    ;(getSiteSeo as ReturnType<typeof vi.fn>).mockResolvedValue({
      pages: { about: { noIndex: true } },
    })
    const urls = (await sitemap()).map((e) => e.url)
    expect(urls).not.toContain('https://lolev.beer/beer/lupula')
    expect(urls).not.toContain('https://lolev.beer/beer/mosaic')
    expect(urls).toContain('https://lolev.beer/beer/citra')
    expect(urls).not.toContain('https://lolev.beer/about')
    expect(urls).toContain('https://lolev.beer/faq')
  })
})

it('omits uncertain hub dates and uses each job timestamp independently of beer updates', async () => {
  const entries = await sitemap()
  for (const path of ['', '/events', '/food', '/faq', '/jobs']) {
    expect(entries.find((e) => e.url === `https://lolev.beer${path}`)?.lastModified).toBeUndefined()
  }
  expect(entries.find((e) => e.url.endsWith('/jobs/bartender'))?.lastModified).toEqual(
    new Date('2026-10-02T12:00:00Z'),
  )
})
