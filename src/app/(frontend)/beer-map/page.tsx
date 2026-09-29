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
import { beerMapDescription, locationKeywords } from '@/lib/utils/seo'
import { getSiteSeo, hubPageSeo } from '@/lib/utils/site-seo'
import { buildPageMetadata } from '@/lib/seo/resolve-metadata'

// ISR: revalidate every hour (locations/distributors change infrequently)
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const [locations, siteSeo] = await Promise.all([getAllLocations(), getSiteSeo()])
  const description = beerMapDescription(locations)
  return buildPageMetadata({
    fallbackTitle: 'Where to Buy Lolev Beer Near You',
    fallbackDescription: description,
    canonicalPath: '/beer-map',
    fallbackKeywords: [
      'where to buy Lolev Beer',
      'find Lolev Beer',
      'Lolev Beer near me',
      'Lolev Beer stores',
      'Lolev Beer retailers',
      'brewery locations',
      'Pittsburgh brewery',
      'beer map',
      'directions',
      ...locationKeywords(locations),
    ],
    seo: hubPageSeo(siteSeo, 'beerMap'),
    siteSeo,
  })
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
