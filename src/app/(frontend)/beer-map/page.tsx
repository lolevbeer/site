/**
 * Beer Map Page
 * Interactive map showing brewery locations
 */

import { Metadata } from 'next'
import { Suspense } from 'react'
import { BeerMapContent } from '@/components/beer/beer-map-content'
import { BeerMapCanvas } from '@/components/beer/beer-map-canvas'
import { MapLoadingSkeleton } from '@/components/map/location-card-skeleton'
import {
  getAllLocations,
  getWeeklyHoursWithHolidays,
  type WeeklyHoursDay,
} from '@/lib/utils/payload-api'
import { JsonLd } from '@/components/seo/json-ld'
import { generateLocalBusinessSchemas } from '@/lib/utils/local-business-schema'
import { beerMapDescription, DEFAULT_OG_IMAGES, locationKeywords } from '@/lib/utils/seo'

// ISR: revalidate every hour (locations/distributors change infrequently)
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const locations = await getAllLocations()
  const description = beerMapDescription(locations)
  return {
    title: 'Find Lolev Beer Near You',
    description,
    keywords: [
      'brewery locations',
      'Pittsburgh brewery',
      'find us',
      'brewery map',
      'directions',
      ...locationKeywords(locations),
    ],
    alternates: { canonical: '/beer-map' },
    openGraph: {
      title: 'Find Lolev Beer Near You | Lolev Beer',
      description,
      type: 'website',
      images: DEFAULT_OG_IMAGES,
    },
  }
}

export default async function BeerMapPage() {
  const locations = await getAllLocations()
  const weeklyHoursEntries = await Promise.all(
    locations.map(async (location) => {
      const hours = await getWeeklyHoursWithHolidays(location.id)
      return [location.slug, hours] as [string, WeeklyHoursDay[]]
    }),
  )
  const weeklyHours: Record<string, WeeklyHoursDay[]> = Object.fromEntries(weeklyHoursEntries)
  const locationSchemas = generateLocalBusinessSchemas(locations, weeklyHours)

  return (
    <>
      {locationSchemas.map((schema, index) => (
        <JsonLd key={index} data={schema} />
      ))}
      <BeerMapContent weeklyHours={weeklyHours}>
        <Suspense fallback={<MapLoadingSkeleton />}>
          <BeerMapCanvas />
        </Suspense>
      </BeerMapContent>
    </>
  )
}
