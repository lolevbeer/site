/**
 * Place and store suggestions for the beer-map search box.
 */

import { lngLat } from '@/lib/map/geo'
import type { MapPoint } from '@/lib/map/points'

export type PlaceSuggestion = {
  id: string
  kind: 'place' | 'store'
  label: string
  subtitle?: string
  latitude?: number
  longitude?: number
  uniqueId?: string
}

export function storeNameSuggestions(
  query: string,
  points: MapPoint[],
  limit = 5,
): PlaceSuggestion[] {
  const term = query.trim().toLowerCase()
  if (term.length < 2) return []
  return points
    .filter(
      (point) =>
        point.name.toLowerCase().includes(term) ||
        point.address.toLowerCase().includes(term),
    )
    .slice(0, limit)
    .map((point) => ({
      id: `store:${point.uniqueId}`,
      kind: 'store' as const,
      label: point.name,
      subtitle: point.kind === 'taproom' ? 'Taproom' : point.address,
      latitude: point.lat,
      longitude: point.lng,
      uniqueId: point.uniqueId,
    }))
}

type MapboxFeature = {
  id?: string
  text?: string
  place_name?: string
  center?: [number, number]
}

export function parseMapboxFeatures(features: MapboxFeature[]): PlaceSuggestion[] {
  return features.flatMap((feature, index) => {
    const coords = lngLat(feature.center)
    if (!coords) return []
    const label = feature.text || feature.place_name
    if (!label) return []
    return [
      {
        id: feature.id || `place:${index}`,
        kind: 'place' as const,
        label,
        subtitle: feature.place_name && feature.place_name !== label ? feature.place_name : undefined,
        latitude: coords.lat,
        longitude: coords.lng,
      },
    ]
  })
}

export function preferPlaceSuggestions(
  query: string,
  places: PlaceSuggestion[] = [],
): boolean {
  const term = query.trim()
  if (/^\d{5}$/.test(term) || term.includes(',') || term.split(/\s+/).length >= 2) return true
  const lower = term.toLowerCase()
  return places.some((place) => place.label.toLowerCase() === lower)
}

export function mergeSuggestions(
  stores: PlaceSuggestion[],
  places: PlaceSuggestion[],
  query = '',
  limit = 8,
): PlaceSuggestion[] {
  const ordered = preferPlaceSuggestions(query, places)
    ? [...places, ...stores]
    : [...stores, ...places]
  const seen = new Set<string>()
  const merged: PlaceSuggestion[] = []
  for (const suggestion of ordered) {
    if (seen.has(suggestion.id)) continue
    seen.add(suggestion.id)
    merged.push(suggestion)
    if (merged.length >= limit) break
  }
  return merged
}
