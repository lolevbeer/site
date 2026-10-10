/**
 * Sitemap must only list public routes that 200, and static lastmod must not
 * be "now" on every request (Google then ignores lastmod site-wide).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/utils/payload-api', () => ({
  getAllBeersFromPayload: vi.fn(),
  getAllLocations: vi.fn(),
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
import { getAllBeersFromPayload, getAllLocations } from '@/lib/utils/payload-api'

const beers = getAllBeersFromPayload as ReturnType<typeof vi.fn>
const locations = getAllLocations as ReturnType<typeof vi.fn>
const jobs = getActiveJobs as ReturnType<typeof vi.fn>

describe('sitemap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://lolev.beer')
    beers.mockResolvedValue([
      {
        slug: 'lupula',
        hideFromSite: false,
        createdAt: '2026-09-01T12:00:00.000Z',
        // The nightly Untappd sync touches updatedAt on every beer.
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
        slug: 'lawrenceville',
        active: true,
        updatedAt: '2026-09-01T16:29:41.957Z',
      },
      {
        slug: 'zelienople',
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
  })

  it('includes location landing pages and visible beer pages', async () => {
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls).toContain('https://lolev.beer/lawrenceville')
    expect(urls).toContain('https://lolev.beer/zelienople')
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

  it('uses beer createdAt for beer URLs and the catalog, not the sync-bumped updatedAt', async () => {
    const entries = await sitemap()
    const lupula = entries.find((e) => e.url === 'https://lolev.beer/beer/lupula')
    expect((lupula?.lastModified as Date).toISOString()).toBe('2026-09-01T12:00:00.000Z')
    const catalog = entries.find((e) => e.url === 'https://lolev.beer/beer')
    expect((catalog?.lastModified as Date).toISOString()).toBe('2026-09-01T12:00:00.000Z')
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
