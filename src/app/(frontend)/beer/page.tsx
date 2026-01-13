/**
 * Beer Listing Page
 * Server component that displays all available beers with filtering and search
 */

import { Metadata } from 'next'
import { BeerPageContent } from '@/components/beer/beer-page-content'
import { getAllBeersFromCSV } from '@/lib/utils/beer-csv'

// ISR: Revalidate every hour as fallback (on-demand revalidation handles immediate updates)
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Our Beers',
  description:
    'Explore our handcrafted selection of beers at Lolev Beer, a modern brewery in Lawrenceville, Pittsburgh. From hop saturate ales to crisy lager, each beer is brewed with care using the finest ingredients.',
  keywords: [
    'craft beer',
    'brewery',
    'Pittsburgh beer',
    'Lawrenceville brewery',
    'IPA',
    'stout',
    'lager',
    'DIPA',
    'Hazy IPA',
  ],
  openGraph: {
    title: 'Our Beers | Lolev Beer',
    description: 'Discover our handcrafted selection of craft beers',
    type: 'website',
  },
}

export default async function BeerPage() {
  // Get all beers from CSV
  const allBeers = await getAllBeersFromCSV()

  // Filter out beers that should be hidden
  const availableBeers = allBeers.filter((beer) => !beer.availability?.hideFromSite)

  return <BeerPageContent beers={availableBeers} />
}
