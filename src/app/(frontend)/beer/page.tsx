/**
 * Beer Listing Page
 * Server component that displays all available beers with filtering and search
 */

import { Metadata } from 'next';
import { BeerPageContent } from '@/components/beer/beer-page-content';
import { getAllBeersFromCSV } from '@/lib/utils/beer-csv';

export const metadata: Metadata = {
  title: 'Our Beers',
  description: 'Explore our handcrafted selection of beers at Love of Lev Brewery. From hoppy IPAs to rich stouts, each beer is brewed with care using the finest ingredients.',
  keywords: ['craft beer', 'brewery', 'Pittsburgh beer', 'Lawrenceville brewery', 'IPA', 'stout', 'lager'],
  openGraph: {
    title: 'Our Beers | Love of Lev Brewery',
    description: 'Discover our handcrafted selection of craft beers',
    type: 'website',
  }
};

export default async function BeerPage() {
  // Get all beers from CSV
  const allBeers = await getAllBeersFromCSV();

  // Filter out beers that should be hidden
  const availableBeers = allBeers.filter(beer => !beer.availability?.hideFromSite);

  return <BeerPageContent beers={availableBeers} />;
}