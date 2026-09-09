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

vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import sitemap from '@/src/app/sitemap'
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
        updatedAt: '2026-09-01T12:00:00.000Z',
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
    jobs.mockResolvedValue([{ slug: 'bartender', title: 'Bartender' }])
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

  it('uses beer updatedAt for beer URLs', async () => {
    const entries = await sitemap()
    const lupula = entries.find((e) => e.url === 'https://lolev.beer/beer/lupula')
    expect((lupula?.lastModified as Date).toISOString()).toBe('2026-09-01T12:00:00.000Z')
  })
})
