/**
 * Beer Map Page
 * Interactive map showing brewery locations
 */

import { Metadata } from 'next';
import { BeerMapContent } from '@/components/beer/beer-map-content';

export const metadata: Metadata = {
  title: 'Find Us | Love of Lev Brewery',
  description: 'Find Love of Lev Brewery locations in Lawrenceville and Zelienople. Get directions, hours, and contact information for both brewery locations.',
  keywords: ['brewery locations', 'Pittsburgh brewery', 'Lawrenceville brewery', 'Zelienople brewery', 'find us', 'brewery map', 'directions'],
  openGraph: {
    title: 'Find Us | Love of Lev Brewery',
    description: 'Visit us at our Lawrenceville or Zelienople locations',
    type: 'website',
  }
};

export default function BeerMapPage() {
  return <BeerMapContent />;
}