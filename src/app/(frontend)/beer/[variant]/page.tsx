import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  getAllBeersFromPayload,
  getAllLocations,
  getBeerBySlug,
  getCansMenu,
  getDraftMenu,
} from '@/lib/utils/payload-api'
import { BeerDetails, type BeerAvailability } from '@/components/beer/beer-details'
import { menuItemHasBeer } from '@/lib/utils/menu-item-utils'
import { JsonLd } from '@/components/seo/json-ld'
import { PageTransition } from '@/components/motion'
import { generateProductSchema } from '@/lib/utils/product-schema'
import { generateBreadcrumbSchema, generateWebPageSchema } from '@/lib/utils/breadcrumb-schema'
import { buildPageMetadata } from '@/lib/seo/resolve-metadata'
import { ogCardImages } from '@/lib/og/paths'

interface BeerPageProps {
  params: Promise<{
    variant: string
  }>
}

export async function generateMetadata({ params }: BeerPageProps): Promise<Metadata> {
  const { variant } = await params

  // Let Payload/DB errors reach error.tsx instead of looking like a 404.
  const beer = await getBeerBySlug(variant)

  if (!beer || beer.hideFromSite) {
    return {
      title: 'Beer Not Found',
    }
  }

  const styleName = typeof beer.style === 'string' ? beer.style : beer.style?.name || ''
  const description =
    (typeof beer.description === 'string' ? beer.description.trim() : '') ||
    `${beer.name}${styleName ? ` — ${styleName}` : ''} beer from Lolev Beer, a craft brewery in Pittsburgh.`

  const pageTitle = styleName ? `${beer.name} • ${styleName}` : beer.name
  const seo = beer.seo

  return buildPageMetadata({
    fallbackTitle: pageTitle,
    fallbackDescription: description,
    canonicalPath: `/beer/${beer.slug}`,
    seo,
    fallbackOgImages: ogCardImages('beer', beer.slug, beer.name),
  })
}

// Limit static generation to popular beers only
// Others will be generated on-demand and cached
export async function generateStaticParams() {
  const beers = await getAllBeersFromPayload()

  // Only pre-render top 10 beers (adjust as needed)
  // Others will be generated on first request
  return beers.slice(0, 10).map((beer) => ({
    variant: beer.slug,
  }))
}

// Enable ISR with 1 hour revalidation
export const revalidate = 3600

/**
 * Taprooms whose website draft/cans menu lists this beer, from the same
 * cached per-location getters the taproom pages use.
 *
 * "On tap" means on the taproom's *selected* website menu (getDraftMenu /
 * getCansMenu); a beer that is only on some other published menu counts as
 * not available. The page's InStock/OutOfStock JSON-LD uses the same rule.
 *
 * Menu errors propagate (like getBeerBySlug's): error.tsx renders and ISR
 * keeps serving the last good page instead of caching a degraded one for the
 * full revalidate window.
 */
async function loadAvailability(beerId: string): Promise<BeerAvailability> {
  const locations = (await getAllLocations()).filter((loc): loc is typeof loc & { slug: string } =>
    Boolean(loc.slug),
  )
  const rows = await Promise.all(
    locations.map(async (loc) => {
      const [draft, cans] = await Promise.all([getDraftMenu(loc.slug), getCansMenu(loc.slug)])
      const has = (menu: typeof draft) =>
        Boolean(menu?.items?.some((item) => menuItemHasBeer(item, beerId)))
      return { place: { name: loc.name, slug: loc.slug }, tap: has(draft), cans: has(cans) }
    }),
  )
  return {
    tap: rows.filter((row) => row.tap).map((row) => row.place),
    cans: rows.filter((row) => row.cans).map((row) => row.place),
  }
}

export default async function BeerPage({ params }: BeerPageProps) {
  const { variant } = await params

  // Let Payload/DB errors reach error.tsx instead of looking like a 404.
  const beer = await getBeerBySlug(variant)
  if (!beer || beer.hideFromSite) notFound()

  const availability = await loadAvailability(beer.id)
  const inStock = availability.tap.length + availability.cans.length > 0
  const productSchema = generateProductSchema(beer, { inStock })
  const webPageSchema = generateWebPageSchema({
    name: beer.name,
    path: `/beer/${beer.slug}`,
    dateModified: beer.updatedAt,
  })
  const breadcrumbSchema = generateBreadcrumbSchema([
    { label: 'Home', href: '/' },
    { label: 'Beer', href: '/beer' },
    { label: beer.name, href: `/beer/${beer.slug}` },
  ])

  return (
    <>
      {/* Add Product JSON-LD for SEO */}
      <JsonLd data={productSchema} />
      <JsonLd data={webPageSchema} />
      <JsonLd data={breadcrumbSchema} />

      <PageTransition>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <BeerDetails beer={beer} availability={availability} />
        </div>
      </PageTransition>
    </>
  )
}
