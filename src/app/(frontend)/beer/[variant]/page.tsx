import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getBeerBySlug, getAllBeersFromPayload, getAvailableBeersFromMenus } from '@/lib/utils/payload-api'
import { DEFAULT_OG_IMAGES } from '@/lib/utils/seo'
import { BeerDetails } from '@/components/beer/beer-details'
import { JsonLd } from '@/components/seo/json-ld'
import { PageTransition } from '@/components/motion'
import { generateProductSchema } from '@/lib/utils/product-schema'
import { generateBreadcrumbSchema } from '@/lib/utils/breadcrumb-schema'
import { getBeerImageUrl } from '@/lib/utils/media-utils'
import { logger } from '@/lib/utils/logger'

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
  const ogImage = getBeerImageUrl(beer.image, beer.slug)

  const pageTitle = styleName ? `${beer.name} | ${styleName}` : beer.name

  return {
    title: pageTitle,
    description,
    alternates: {
      canonical: `/beer/${beer.slug}`,
    },
    openGraph: {
      title: `${pageTitle} | Lolev Beer`,
      description,
      type: 'website',
      url: `/beer/${beer.slug}`,
      images: ogImage ? [{ url: ogImage, alt: beer.name }] : DEFAULT_OG_IMAGES,
    },
  }
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

export default async function BeerPage({ params }: BeerPageProps) {
  const { variant } = await params

  // Let Payload/DB errors reach error.tsx instead of looking like a 404.
  const beer = await getBeerBySlug(variant)
  if (!beer || beer.hideFromSite) notFound()

  let inStock: boolean | undefined
  try {
    const onMenu = await getAvailableBeersFromMenus()
    if (onMenu.some((candidate) => candidate.id === beer.id)) inStock = true
  } catch (error) {
    logger.error('Could not load menus for product availability', error)
  }
  const productSchema = generateProductSchema(beer, { inStock })
  const breadcrumbSchema = generateBreadcrumbSchema([
    { label: 'Home', href: '/' },
    { label: 'Beer', href: '/beer' },
    { label: beer.name, href: `/beer/${beer.slug}` },
  ])

  return (
    <>
      {/* Add Product JSON-LD for SEO */}
      <JsonLd data={productSchema} />
      <JsonLd data={breadcrumbSchema} />

      <PageTransition>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <BeerDetails beer={beer} />
        </div>
      </PageTransition>
    </>
  )
}
