'use client'

/**
 * Beer map page body: taproom hours plus the distributor map.
 *
 * Hours use the same WeeklyHoursTable as the homepage cards, taproom
 * landings, and footer — not a separate accordion.
 */

import React from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs'
import { MapLoadingSkeleton } from '@/components/map/location-card-skeleton'
import { WeeklyHoursTable } from '@/components/location/weekly-hours'
import { useLocationContext } from '@/components/location/location-provider'
import { formatCityStateZip } from '@/lib/config/locations'
import type { WeeklyHoursDay, DistributorGeoJSON } from '@/lib/utils/payload-api'

// Lazy load the map component - no SSR for better performance
const DistributorMap = dynamic(
  () => import('@/components/ui/distributor-map').then((mod) => mod.DistributorMap),
  {
    ssr: false,
    loading: () => <MapLoadingSkeleton />,
  },
)

interface BeerMapContentProps {
  weeklyHours?: Record<string, WeeklyHoursDay[]>
  distributorData?: DistributorGeoJSON
}

export function BeerMapContent({ weeklyHours, distributorData }: BeerMapContentProps) {
  const { locations } = useLocationContext()

  return (
    <div className="container mx-auto px-4 py-8">
      <PageBreadcrumbs className="mb-6" />
      {/* Page Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-2">Find Lolev Beer near you</h1>
        <div className="w-16 h-1 bg-primary mx-auto rounded-full" />
      </div>

      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
        {locations.map((location) => {
          const key = location.slug || location.id
          const hours = weeklyHours?.[key]
          const street = location.address?.street
          const cityLine = formatCityStateZip(location.address)
          const phone = location.basicInfo?.phone

          return (
            <div key={key} className="flex flex-col items-center text-center space-y-4">
              <h2 className="text-2xl font-bold">
                {location.slug ? (
                  <Link
                    href={`/${location.slug}`}
                    className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {location.name}
                  </Link>
                ) : (
                  location.name
                )}
              </h2>
              {street || cityLine || phone ? (
                <address className="not-italic text-sm text-muted-foreground space-y-0.5">
                  {street ? <p>{street}</p> : null}
                  {cityLine ? <p>{cityLine}</p> : null}
                  {phone ? (
                    <p>
                      <a href={`tel:${phone}`} className="hover:underline">
                        {phone}
                      </a>
                    </p>
                  ) : null}
                </address>
              ) : null}
              {hours ? (
                <div className="w-full max-w-xs">
                  <WeeklyHoursTable weeklyHours={hours} variant="card" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Hours not available</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Distributor Map */}
      <div className="overflow-hidden" style={{ height: '700px', position: 'relative' }}>
        <DistributorMap
          height={700}
          showSearch={true}
          initialZoom={5}
          maxPoints={10}
          initialData={distributorData}
        />
      </div>
    </div>
  )
}
