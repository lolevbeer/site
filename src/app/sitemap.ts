import { MetadataRoute } from 'next'
import { getActiveJobs } from '@/lib/jobs/payload'
import { getAllBeersFromPayload, getAllLocations } from '@/lib/utils/payload-api'
import { logger } from '@/lib/utils/logger'
import { getBaseUrl } from '@/lib/utils/get-base-url'
import { RESERVED_LOCATION_SLUGS } from '@/lib/config/locations'
import { LEGAL_PAGES_LASTMOD } from '@/lib/legal/dates'
import { getSiteSeo } from '@/lib/utils/site-seo'
import { trim } from '@/lib/utils/seo'
import type { SeoOverride } from '@/lib/seo/resolve-metadata'
import type { SiteSeoPageKey } from '@/src/globals/SiteSeo'

/** lastmod for pages that change with code, not CMS. YYYY-MM-DD of last meaningful edit. */
const STATIC_LASTMOD = {
  '/about': '2026-03-05',
  '/faq': undefined,
  '/accessibility': LEGAL_PAGES_LASTMOD,
  '/privacy': LEGAL_PAGES_LASTMOD,
  '/terms': LEGAL_PAGES_LASTMOD,
  '/beer-map': '2026-09-09',
  '/donate': '2026-09-09',
  '/jobs': undefined,
} as const

const STATIC_INFO_PAGES: Array<{
  path: keyof typeof STATIC_LASTMOD
  key: SiteSeoPageKey
  changeFrequency: 'weekly' | 'monthly' | 'yearly'
  priority: number
}> = [
  { path: '/beer-map', key: 'beerMap', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/donate', key: 'donate', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/jobs', key: 'jobs', changeFrequency: 'weekly', priority: 0.4 },
  { path: '/about', key: 'about', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/faq', key: 'faq', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/accessibility', key: 'accessibility', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/privacy', key: 'privacy', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/terms', key: 'terms', changeFrequency: 'yearly', priority: 0.2 },
]

function maxDate(dates: Array<string | Date | undefined | null>): Date {
  const times = dates
    .map((d) => (d ? new Date(d).getTime() : NaN))
    .filter((t) => Number.isFinite(t))
  return new Date(times.length ? Math.max(...times) : Date.parse('2026-03-05'))
}

/**
 * A page belongs in the sitemap only if its CMS SEO lets it be indexed and it is its own
 * canonical URL (a canonical override points crawlers at some other URL instead).
 */
function isListed(path: string, seo: SeoOverride): boolean {
  if (seo?.noIndex) return false
  const canonical = trim(seo?.canonicalPath)
  return !canonical || canonical === path
}

type StaticPage = {
  path: string
  key: SiteSeoPageKey
  lastModified?: Date
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>
  priority: number
}

/** Log a failed source and continue with none, so one outage cannot empty the whole sitemap. */
const orEmpty = <T>(source: Promise<T[]>, name: string) =>
  source.catch((error) => {
    logger.error(`Error fetching ${name} for sitemap:`, error)
    return [] as T[]
  })

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl()
  const [siteSeo, beers, locations, jobs] = await Promise.all([
    getSiteSeo(),
    orEmpty(getAllBeersFromPayload(), 'beers'),
    orEmpty(getAllLocations(), 'locations'),
    orEmpty(getActiveJobs(), 'jobs'),
  ])

  const visibleBeers = beers.filter((beer) => beer.slug && !beer.hideFromSite)
  const activeLocations = locations.filter(
    (loc) => loc.active && loc.slug && !RESERVED_LOCATION_SLUGS.has(loc.slug),
  )
  const catalogLastmod = maxDate(visibleBeers.map((b) => b.updatedAt))
  const homeLastmod = maxDate([catalogLastmod, ...activeLocations.map((l) => l.updatedAt)])

  const staticEntries: StaticPage[] = [
    { path: '/', key: 'home', changeFrequency: 'daily', priority: 1 },
    {
      path: '/beer',
      key: 'beer',
      lastModified: catalogLastmod,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    { path: '/events', key: 'events', changeFrequency: 'daily', priority: 0.8 },
    { path: '/food', key: 'food', changeFrequency: 'daily', priority: 0.8 },
    ...STATIC_INFO_PAGES.map((page) => ({
      ...page,
      lastModified: STATIC_LASTMOD[page.path] ? new Date(STATIC_LASTMOD[page.path]!) : undefined,
    })),
  ]
  const staticPages: MetadataRoute.Sitemap = staticEntries
    // Hub SEO groups have no canonical field, so noIndex is the only thing that can hide them.
    .filter((page) => !siteSeo.pages?.[page.key]?.noIndex)
    .map(({ path, changeFrequency, priority, lastModified }) => ({
      url: path === '/' ? baseUrl : `${baseUrl}${path}`,
      lastModified,
      changeFrequency,
      priority,
    }))

  const beerPages: MetadataRoute.Sitemap = visibleBeers
    .filter((beer) => isListed(`/beer/${beer.slug}`, beer.seo))
    .map((beer) => ({
      url: `${baseUrl}/beer/${beer.slug}`,
      lastModified: beer.updatedAt ? new Date(beer.updatedAt) : catalogLastmod,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

  const locationPages: MetadataRoute.Sitemap = activeLocations
    .filter((loc) => isListed(`/${loc.slug}`, loc.seo))
    .map((loc) => ({
      url: `${baseUrl}/${loc.slug}`,
      lastModified: loc.updatedAt ? new Date(loc.updatedAt) : homeLastmod,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))

  const jobPages: MetadataRoute.Sitemap = jobs
    .filter((job) => isListed(`/jobs/${job.slug}`, job.seo))
    .map((job) => ({
      url: `${baseUrl}/jobs/${job.slug}`,
      lastModified: new Date(job.updatedAt || job.postedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.4,
    }))

  return [...staticPages, ...beerPages, ...locationPages, ...jobPages]
}
