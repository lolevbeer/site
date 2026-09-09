/**
 * Beer-map list: taprooms plus filtered retailers, sorted from a reference point.
 */

import { formatCityStateZip } from '@/lib/config/locations'
import { distanceMiles, lngLat, locationLngLat } from '@/lib/map/geo'
import type { PayloadLocation } from '@/lib/types/location'

export type MapPointKind = 'taproom' | 'retailer'

export type MapPoint = {
  uniqueId: string
  name: string
  address: string
  lng: number
  lat: number
  kind: MapPointKind
  slug?: string
}

export type ReferencePoint = {
  latitude: number
  longitude: number
  label: string
}

export type MapPointWithDistance = MapPoint & { distance?: number }

export function taproomPoints(locations: PayloadLocation[]): MapPoint[] {
  return locations.flatMap((location) => {
    const coords = locationLngLat(location)
    if (!coords) return []
    const street = location.address?.street?.trim()
    const cityLine = formatCityStateZip(location.address)
    const address = [street, cityLine].filter(Boolean).join(', ')
    const slug = location.slug || location.id
    return [
      {
        uniqueId: `taproom:${slug}`,
        name: location.name,
        address,
        lng: coords.lng,
        lat: coords.lat,
        kind: 'taproom' as const,
        slug,
      },
    ]
  })
}

export function retailerPoints(
  features: Array<{
    geometry: { coordinates: [number, number] }
    properties: {
      uniqueId?: string
      id?: number | string
      Name: string
      address: string
    }
  }>,
): MapPoint[] {
  return features.flatMap((feature) => {
    const coords = lngLat(feature.geometry.coordinates)
    if (!coords) return []
    const uniqueId = String(feature.properties.uniqueId ?? feature.properties.id ?? '')
    if (!uniqueId) return []
    return [
      {
        uniqueId,
        name: feature.properties.Name,
        address: feature.properties.address,
        lng: coords.lng,
        lat: coords.lat,
        kind: 'retailer' as const,
      },
    ]
  })
}

export function withDistance(
  point: MapPoint,
  reference: ReferencePoint | null,
): MapPointWithDistance {
  if (!reference) return point
  return {
    ...point,
    distance: distanceMiles(reference.latitude, reference.longitude, point.lat, point.lng),
  }
}

export function sortMapPoints(
  points: MapPointWithDistance[],
): MapPointWithDistance[] {
  return [...points].sort((a, b) => {
    if (a.distance !== undefined && b.distance !== undefined && a.distance !== b.distance) {
      return a.distance - b.distance
    }
    if (a.kind !== b.kind) return a.kind === 'taproom' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export function buildMapList({
  taprooms,
  retailers,
  reference,
  limit,
}: {
  taprooms: MapPoint[]
  retailers: MapPoint[]
  reference: ReferencePoint | null
  limit: number
}): { items: MapPointWithDistance[]; total: number } {
  const combined = sortMapPoints(
    [...taprooms, ...retailers].map((point) => withDistance(point, reference)),
  )
  return { items: combined.slice(0, limit), total: combined.length }
}

export function referenceFromTaproom(
  location: PayloadLocation | null | undefined,
): ReferencePoint | null {
  if (!location) return null
  const coords = locationLngLat(location)
  if (!coords) return null
  return { latitude: coords.lat, longitude: coords.lng, label: location.name }
}
