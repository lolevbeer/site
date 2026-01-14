/**
 * Beer Map Page
 * Interactive map showing brewery locations
 */

import { Metadata } from 'next'
import { BeerMapContent } from '@/components/beer/beer-map-content'
import {
  getAllLocations,
  getWeeklyHoursWithHolidays,
  getAllDistributorsGeoJSON,
  type WeeklyHoursDay,
} from '@/lib/utils/payload-api'
import { JsonLd } from '@/components/seo/json-ld'
import { generateLocalBusinessSchemas } from '@/lib/utils/local-business-schema'
import { generateBreadcrumbSchema } from '@/lib/utils/breadcrumb-schema'

export const metadata: Metadata = {
  title: 'Find Us | Lolev Beer',
  description:
    "Find Lolev's locations in Lawrenceville and Zelienople. Get directions, hours, and contact information for both brewery locations.",
  keywords: [
    'brewery locations',
    'Pittsburgh brewery',
    'Lawrenceville brewery',
    'Zelienople brewery',
    'find us',
    'brewery map',
    'directions',
  ],
  openGraph: {
    title: 'Find Us | Lolev Beer',
    description: 'Visit us at our Lawrenceville or Zelienople locations',
    type: 'website',
  },
}

export default async function BeerMapPage() {
  // Fetch locations, weekly hours, and distributors in parallel
  const [locations, distributorData] = await Promise.all([
    getAllLocations(),
    getAllDistributorsGeoJSON(),
  ])

  const weeklyHoursEntries = await Promise.all(
    locations.map(async (location) => {
      const hours = await getWeeklyHoursWithHolidays(location.id)
      return [location.slug, hours] as [string, WeeklyHoursDay[]]
    }),
  )
  const weeklyHours: Record<string, WeeklyHoursDay[]> = Object.fromEntries(weeklyHoursEntries)

  // Generate JSON-LD schemas for SEO
  const locationSchemas = generateLocalBusinessSchemas(locations)
  const breadcrumbSchema = generateBreadcrumbSchema([
    { label: 'Home', href: '/' },
    { label: 'Find Us', href: '/beer-map' },
  ])

  return (
    <>
      {locationSchemas.map((schema, index) => (
        <JsonLd key={index} data={schema} />
      ))}
      <JsonLd data={breadcrumbSchema} />
      <BeerMapContent weeklyHours={weeklyHours} distributorData={distributorData} />
    </>
  )
}
