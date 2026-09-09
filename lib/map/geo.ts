/**
 * Map geometry helpers. Coordinates are GeoJSON order: [longitude, latitude].
 */

export const EARTH_RADIUS_MILES = 3959

/** Lawrenceville taproom, from the Locations collection example. */
export const DEFAULT_MAP_CENTER = { latitude: 40.465372, longitude: -79.960098 }
export const DEFAULT_MAP_ZOOM = 9
export const TAPROOM_ZOOM = 10
export const PLACE_ZOOM = 12
export const DETAIL_ZOOM = 14

export type LngLat = { lng: number; lat: number }

export function lngLat(
  coordinates:
    | [number, number]
    | { coordinates?: [number, number] | null }
    | null
    | undefined,
): LngLat | null {
  if (!coordinates) return null
  const pair = Array.isArray(coordinates) ? coordinates : coordinates.coordinates
  if (!pair || pair.length !== 2) return null
  const [lng, lat] = pair
  if (![lng, lat].every((n) => typeof n === 'number' && Number.isFinite(n))) return null
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null
  return { lng, lat }
}

export function googleDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

/** `@lat,lng` or `!3dlat!4dlng` from a Google Maps directions URL. */
export function coordsFromDirectionsUrl(url: string | null | undefined): LngLat | null {
  if (!url) return null
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (at) return lngLat([Number(at[2]), Number(at[1])])
  const bang = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (bang) return lngLat([Number(bang[2]), Number(bang[1])])
  return null
}

export function locationLngLat(location: {
  coordinates?: [number, number] | null
  address?: { directionsUrl?: string | null } | null
} | null | undefined): LngLat | null {
  if (!location) return null
  return lngLat(location.coordinates) ?? coordsFromDirectionsUrl(location.address?.directionsUrl)
}

export function distanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_MILES * c
}

export function cameraForTaproom(
  coordinates: [number, number] | null | undefined,
): { latitude: number; longitude: number; zoom: number } {
  const coords = lngLat(coordinates)
  if (!coords) return { ...DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM }
  return { latitude: coords.lat, longitude: coords.lng, zoom: TAPROOM_ZOOM }
}

export function cameraForLocation(
  location: {
    coordinates?: [number, number] | null
    address?: { directionsUrl?: string | null } | null
  } | null | undefined,
): { latitude: number; longitude: number; zoom: number } {
  const coords = locationLngLat(location)
  return cameraForTaproom(coords ? [coords.lng, coords.lat] : null)
}
