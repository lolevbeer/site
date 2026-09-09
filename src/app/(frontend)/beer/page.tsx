/**
 * Beer Listing Page
 * Server component that displays all available beers with filtering and search
 */

import { Metadata } from 'next'
import { BeerPageContent } from '@/components/beer/beer-page-content'
import { getAllBeers } from '@/lib/utils/payload-beers'
import { JsonLd } from '@/components/seo/json-ld'
import { generateBeerListSchema } from '@/lib/utils/product-schema'
import { beersDescription, DEFAULT_OG_IMAGES, locationKeywords } from '@/lib/utils/seo'
import { getAllLocations } from '@/lib/utils/payload-api'

// ISR: Revalidate every hour as fallback (on-demand revalidation handles immediate updates)
export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const locations = await getAllLocations()
  const description = beersDescription(locations)
  return {
    title: 'Our Beers',
    description,
    keywords: [
      'craft beer',
      'brewery',
      'Pittsburgh beer',
      'IPA',
      'stout',
      'lager',
      'DIPA',
      'Hazy IPA',
      ...locationKeywords(locations),
    ],
    alternates: {
      canonical: '/beer',
    },
    openGraph: {
      title: 'Our Beers | Lolev Beer',
      description,
      type: 'website',
      images: DEFAULT_OG_IMAGES,
    },
  }
}

export default async function BeerPage() {
  const allBeers = await getAllBeers()

  // Filter out beers that should be hidden
  const availableBeers = allBeers.filter((beer) => !beer.availability?.hideFromSite)

  // Generate ItemList schema for SEO
  const beerListSchema = generateBeerListSchema(availableBeers)

  return (
    <>
      {/* JSON-LD structured data for beer collection */}
      <JsonLd data={beerListSchema} />
      <BeerPageContent beers={availableBeers} />
    </>
  )
}
