/**
 * Generated social card for one taproom. 404 for unknown locations.
 */
import { getAllLocations } from '@/lib/utils/payload-api'
import { findLocationBySlug, formatCityStateZip } from '@/lib/config/locations'
import { ogNotFound, renderOgCard } from '@/lib/og/card'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const location = findLocationBySlug(await getAllLocations(), slug)
  if (!location) return ogNotFound()

  return renderOgCard({
    title: `${location.name} Taproom`,
    subtitle: formatCityStateZip(location.address) || undefined,
  })
}
