/**
 * Slow half of /beer-map: distributor GeoJSON. Streamed behind Suspense so
 * taproom hours are not blocked on the map payload.
 */

import { getAllDistributorsGeoJSON } from '@/lib/utils/payload-api'
import { DistributorMapLoader } from '@/components/beer/distributor-map-loader'

export async function BeerMapCanvas() {
  const distributorData = await getAllDistributorsGeoJSON()
  return <DistributorMapLoader initialData={distributorData} />
}
