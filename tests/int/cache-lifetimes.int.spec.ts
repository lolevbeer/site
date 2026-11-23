/**
 * Guards the settings that keep Vercel load down. The reads below carry cache
 * tags and never depend on the clock, so a short time-based fallback only adds
 * regenerations: Next caps a page at the shortest lifetime of any read it makes,
 * and the root layout's reads are on every page.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const lifetimes = vi.hoisted(() => new Map<string, number | undefined>())

vi.mock('next/cache', () => ({
  unstable_cache: (_fn: unknown, keys: string[], options: { revalidate?: number }) => {
    lifetimes.set(keys.join(':'), options.revalidate)
    return async () => null
  },
}))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@/src/payload.config', () => ({ default: {} }))
vi.mock('@/lib/jobs/payload', () => ({ getJobBySlug: vi.fn() }))

import {
  fetchGlobal,
  getAllUpcomingEventsFromPayload,
  getAvailableBeersFromMenus,
  getComingSoonBeers,
  getDraftMenu,
  getMenusByLocation,
  getPublicEventById,
  getCombinedUpcomingFood,
  getUpcomingEventsFromPayload,
  getUpcomingFoodFromPayload,
  getWeeklyHoursWithHolidays,
} from '@/lib/utils/payload-api'

import { generateStaticParams as jobParams } from '@/src/app/(frontend)/jobs/[slug]/page'
import nextConfig from '../../next.config.mjs'
import { textureImageUrl } from '@/lib/utils/media-utils'

describe('tagged, clock-independent reads', () => {
  beforeEach(() => lifetimes.clear())

  it.each([
    ['site SEO (root layout metadata)', () => fetchGlobal('site-seo', 1)],
    ['weekly hours (root layout footer)', () => getWeeklyHoursWithHolidays('loc-1')],
    ['draft menu (beer pages)', () => getDraftMenu('lolev-lawrenceville')],
    ['menus for a location', () => getMenusByLocation('lolev-lawrenceville')],
    ['available beers', () => getAvailableBeersFromMenus()],
    ['coming soon', () => getComingSoonBeers()],
    // Day-keyed: the Pittsburgh date is in the cache key, so only saves and
    // midnight change the result.
    [
      'events for a location (taproom pages)',
      () => getUpcomingEventsFromPayload('lolev-lawrenceville', 5),
    ],
    ['all upcoming events', () => getAllUpcomingEventsFromPayload()],
    ['one event', () => getPublicEventById('0123456789abcdef01234567')],
    ['food for a location', () => getUpcomingFoodFromPayload('lolev-lawrenceville', 5)],
    ['food with recurring vendors', () => getCombinedUpcomingFood('lolev-lawrenceville', 5)],
  ])('%s keeps an hourly fallback', async (_name, read) => {
    await read().catch(() => null)
    expect(lifetimes.size).toBeGreaterThan(0)
    for (const revalidate of lifetimes.values()) expect(revalidate).toBeGreaterThanOrEqual(3600)
  })
})

describe('tagged reads with no time-based reason to expire', () => {
  // Reads the mock above can't reach (nested caches, the jobs module): none
  // keeps a 5-minute fallback, which made ISR regenerations wait on Mongo.
  it.each(['lib/utils/payload-api.ts', 'lib/jobs/payload.ts', 'src/app/(frontend)/food/page.tsx'])(
    '%s has no fallback shorter than an hour',
    (file) => {
      const source = readFileSync(join(process.cwd(), file), 'utf8')
      const lifetimes = [...source.matchAll(/revalidate: (\d[\d_]*)/g)].map((m) =>
        Number(m[1].replaceAll('_', '')),
      )
      expect(lifetimes.length).toBeGreaterThan(0)
      for (const revalidate of lifetimes) expect(revalidate).toBeGreaterThanOrEqual(3600)
    },
  )
})

describe('on-demand ISR routes', () => {
  // Without generateStaticParams a dynamic route renders per request and its
  // `revalidate` export does nothing.
  it('caches job pages on their first request', () => {
    expect(jobParams()).toEqual([])
  })
})

describe('Vercel cron', () => {
  const { crons } = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
    crons: { path: string; schedule: string }[]
  }

  it('wakes the job queue only around the 06:00 UTC schedule, with room for retries', () => {
    expect(crons.find((cron) => cron.path === '/api/cron/sync-untappd')?.schedule).toBe(
      '*/5 6-7 * * *',
    )
  })

  it('keeps every scheduled task inside the cron window', () => {
    const jobs = join(process.cwd(), 'src/jobs')
    for (const file of readdirSync(jobs)) {
      const source = readFileSync(join(jobs, file), 'utf8')
      const hours = [...source.matchAll(/cron:\s*'\d+ \d+ (\d+) \* \* \*'/g)].map((m) =>
        Number(m[1]),
      )
      expect(hours.length, `${file} has no daily schedule`).toBeGreaterThan(0)
      for (const hour of hours) expect([6, 7], file).toContain(hour)
    }
  })
})

describe('image optimization', () => {
  it('keeps transformed images for 31 days instead of re-transforming every 4 hours', () => {
    expect(nextConfig.images?.minimumCacheTTL).toBe(2_678_400)
  })

  it('limits the widths each image can be transformed at', () => {
    expect(nextConfig.images?.deviceSizes).toEqual([640, 828, 1200, 1920, 2560])
  })

  it('serves the 3D can textures at a listed width', () => {
    const width = Number(
      new URL(textureImageUrl('/a.png')!, 'https://x.test').searchParams.get('w'),
    )
    expect([
      ...(nextConfig.images?.deviceSizes ?? []),
      ...(nextConfig.images?.imageSizes ?? []),
    ]).toContain(width)
  })
})
