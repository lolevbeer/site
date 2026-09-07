/**
 * Canonical public origin for metadata, robots, sitemap, Slack, and feeds.
 * A localhost fallback in production would deindex the site.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBaseUrl } from '@/lib/utils/get-base-url'
import { formatHourMinute, joinLocationNames } from '@/lib/config/locations'
import { beersDescription, siteDescription } from '@/lib/utils/seo'

describe('getBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('prefers NEXT_PUBLIC_SITE_URL and strips a trailing slash', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://lolev.beer/')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'ignored.vercel.app')
    vi.stubEnv('VERCEL_URL', 'also-ignored.vercel.app')
    expect(getBaseUrl()).toBe('https://lolev.beer')
  })

  it('uses the Vercel production domain next', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'lolev.beer')
    vi.stubEnv('VERCEL_URL', 'preview.vercel.app')
    expect(getBaseUrl()).toBe('https://lolev.beer')
  })

  it('uses VERCEL_URL for preview deployments', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '')
    vi.stubEnv('VERCEL_URL', 'site-git-seo.vercel.app')
    expect(getBaseUrl()).toBe('https://site-git-seo.vercel.app')
  })

  it('falls back to https://lolev.beer, never localhost', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '')
    vi.stubEnv('VERCEL_URL', '')
    expect(getBaseUrl()).toBe('https://lolev.beer')
    expect(getBaseUrl()).not.toContain('localhost')
  })

  it('ignores NEXT_PUBLIC_SITE_URL without a scheme so metadataBase does not throw', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'lolev.beer')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '')
    vi.stubEnv('VERCEL_URL', '')
    expect(getBaseUrl()).toBe('https://lolev.beer')
  })
})

describe('joinLocationNames', () => {
  it('joins two names with and', () => {
    expect(joinLocationNames([{ name: 'Lawrenceville' }, { name: 'Zelienople' }])).toBe(
      'Lawrenceville and Zelienople',
    )
  })

  it('joins three names with commas', () => {
    expect(
      joinLocationNames([{ name: 'A' }, { name: 'B' }, { name: 'C' }]),
    ).toBe('A, B, and C')
  })

  it('returns empty when Payload has no locations', () => {
    expect(joinLocationNames([])).toBe('')
    expect(siteDescription([])).not.toMatch(/Lawrenceville|Zelienople/)
    expect(beersDescription([])).toMatch(/from our taprooms/)
  })
})

describe('formatHourMinute', () => {
  it('does not emit Invalid Date for unparseable ISO strings', () => {
    expect(formatHourMinute('not-a-dateT', 'America/New_York')).toBe('00:00')
  })
})
