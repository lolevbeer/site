import { MetadataRoute } from 'next'
import { getActiveJobs } from '@/lib/jobs/payload'
import { getAllBeersFromPayload, getAllLocations } from '@/lib/utils/payload-api'
import { logger } from '@/lib/utils/logger'
import { getBaseUrl } from '@/lib/utils/get-base-url'
import { RESERVED_LOCATION_SLUGS } from '@/lib/config/locations'

/** lastmod for pages that change with code, not CMS. YYYY-MM-DD of last meaningful edit. */
const STATIC_LASTMOD = {
  '/about': '2026-03-05',
  '/faq': '2026-03-05',
  '/accessibility': '2026-03-05',
  '/privacy': '2025-10-02',
  '/terms': '2025-10-02',
  '/beer-map': '2026-09-07',
  '/donate': '2026-09-09',
  '/jobs': '2026-09-09',
} as const

const STATIC_INFO_PAGES: Array<{
  path: keyof typeof STATIC_LASTMOD
  changeFrequency: 'weekly' | 'monthly' | 'yearly'
  priority: number
}> = [
  { path: '/beer-map', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/donate', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/jobs', changeFrequency: 'weekly', priority: 0.4 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/accessibility', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.2 },
]

function maxDate(dates: Array<string | Date | undefined | null>): Date {
  const times = dates
    .map((d) => (d ? new Date(d).getTime() : NaN))
    .filter((t) => Number.isFinite(t))
  return new Date(times.length ? Math.max(...times) : Date.parse('2026-03-05'))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl()

  let beers: Awaited<ReturnType<typeof getAllBeersFromPayload>> = []
  let locations: Awaited<ReturnType<typeof getAllLocations>> = []
  let jobs: Awaited<ReturnType<typeof getActiveJobs>> = []
  try {
    beers = await getAllBeersFromPayload()
  } catch (error) {
    logger.error('Error fetching beers for sitemap:', error)
  }
  try {
    locations = await getAllLocations()
  } catch (error) {
    logger.error('Error fetching locations for sitemap:', error)
  }
  try {
    jobs = await getActiveJobs()
  } catch (error) {
    logger.error('Error fetching jobs for sitemap:', error)
  }

  const visibleBeers = beers.filter((beer) => beer.slug && !beer.hideFromSite)
  const activeLocations = locations.filter(
    (loc) => loc.active && loc.slug && !RESERVED_LOCATION_SLUGS.has(loc.slug),
  )
  const catalogLastmod = maxDate(visibleBeers.map((b) => b.updatedAt))
  const homeLastmod = maxDate([
    catalogLastmod,
    ...activeLocations.map((l) => l.updatedAt),
  ])

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: homeLastmod, changeFrequency: 'daily', priority: 1 },
    {
      url: `${baseUrl}/beer`,
      lastModified: catalogLastmod,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/events`,
      lastModified: homeLastmod,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/food`,
      lastModified: homeLastmod,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    ...STATIC_INFO_PAGES.map((page) => ({
      url: `${baseUrl}${page.path}`,
      lastModified: new Date(STATIC_LASTMOD[page.path]),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
  ]

  const beerPages: MetadataRoute.Sitemap = visibleBeers.map((beer) => ({
    url: `${baseUrl}/beer/${beer.slug}`,
    lastModified: beer.updatedAt ? new Date(beer.updatedAt) : catalogLastmod,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const locationPages: MetadataRoute.Sitemap = activeLocations.map((loc) => ({
    url: `${baseUrl}/${loc.slug}`,
    lastModified: loc.updatedAt ? new Date(loc.updatedAt) : homeLastmod,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  const jobPages: MetadataRoute.Sitemap = jobs.map((job) => ({
    url: `${baseUrl}/jobs/${job.slug}`,
    lastModified: homeLastmod,
    changeFrequency: 'weekly' as const,
    priority: 0.4,
  }))

  return [...staticPages, ...beerPages, ...locationPages, ...jobPages]
}
