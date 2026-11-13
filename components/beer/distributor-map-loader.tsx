'use client'

/**
 * Client island for the beer-map Mapbox bundle. Hours and NAP render in the
 * parent; this only waits on the map JS.
 */

import dynamic from 'next/dynamic'
import { MapLoadingSkeleton } from '@/components/map/map-loading-skeleton'
import type { DistributorGeoJSON } from '@/lib/utils/payload-api'

const DistributorMap = dynamic(
  () => import('@/components/ui/distributor-map').then((mod) => mod.DistributorMap),
  {
    ssr: false,
    loading: () => <MapLoadingSkeleton />,
  },
)

export function DistributorMapLoader({ geoData }: { geoData: DistributorGeoJSON }) {
  return <DistributorMap height={700} geoData={geoData} />
}
