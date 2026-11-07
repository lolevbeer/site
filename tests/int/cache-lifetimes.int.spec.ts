/**
 * Guards the settings that keep Vercel load down. The reads below carry cache
 * tags and never depend on the clock, so a short time-based fallback only adds
 * regenerations: Next caps a page at the shortest lifetime of any read it makes,
 * and the root layout's reads are on every page.
 */
import { readFileSync } from 'node:fs'
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
  getAvailableBeersFromMenus,
  getComingSoonBeers,
  getDraftMenu,
  getMenusByLocation,
  getWeeklyHoursWithHolidays,
} from '@/lib/utils/payload-api'
import { generateStaticParams as jobParams } from '@/src/app/(frontend)/jobs/[slug]/page'
import nextConfig from '../../next.config.mjs'

describe('tagged, clock-independent reads', () => {
  beforeEach(() => lifetimes.clear())

  it.each([
    ['site SEO (root layout metadata)', () => fetchGlobal('site-seo', 1)],
    ['weekly hours (root layout footer)', () => getWeeklyHoursWithHolidays('loc-1')],
    ['draft menu (beer pages)', () => getDraftMenu('lolev-lawrenceville')],
    ['menus for a location', () => getMenusByLocation('lolev-lawrenceville')],
    ['available beers', () => getAvailableBeersFromMenus()],
    ['coming soon', () => getComingSoonBeers()],
  ])('%s keeps an hourly fallback', async (_name, read) => {
    await read().catch(() => null)
    expect(lifetimes.size).toBeGreaterThan(0)
    for (const revalidate of lifetimes.values()) expect(revalidate).toBeGreaterThanOrEqual(3600)
  })
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
})

describe('image optimization', () => {
  it('keeps transformed images for 31 days instead of re-transforming every 4 hours', () => {
    expect(nextConfig.images?.minimumCacheTTL).toBe(2_678_400)
  })

  it('limits the widths each image can be transformed at', () => {
    expect(nextConfig.images?.deviceSizes).toEqual([640, 828, 1200, 1920, 2560])
  })
})
