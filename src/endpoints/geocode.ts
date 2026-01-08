const BING_MAPS_API_KEY = process.env.BING_MAPS_API_KEY || ''

// Nominatim geocoding (free, rate limited 1 req/sec)
async function geocodeWithNominatim(address: string): Promise<[number, number] | null> {
  const encoded = encodeURIComponent(address)
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1&countrycodes=us`

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'LolevBeer/1.0' },
    })
    if (!response.ok) return null
    const data = await response.json()
    if (data.length === 0) return null
    return [parseFloat(data[0].lon), parseFloat(data[0].lat)]
  } catch {
    return null
  }
}

// Bing Maps fallback (requires API key)
async function geocodeWithBing(address: string): Promise<[number, number] | null> {
  if (!BING_MAPS_API_KEY) return null

  const encoded = encodeURIComponent(address)
  const url = `https://dev.virtualearth.net/REST/v1/Locations?q=${encoded}&key=${BING_MAPS_API_KEY}`

  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const data = await response.json()
    if (!data.resourceSets?.[0]?.resources?.[0]?.point?.coordinates) return null
    // Bing returns [lat, lng] - swap to [lng, lat]
    const [lat, lng] = data.resourceSets[0].resources[0].point.coordinates
    return [lng, lat]
  } catch {
    return null
  }
}

export interface GeocodeResult {
  coords: [number, number]
  source: string
}

// Geocode address: Nominatim first, then Bing fallback
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const nominatimResult = await geocodeWithNominatim(address)
  if (nominatimResult) {
    return { coords: nominatimResult, source: 'Nominatim' }
  }

  const bingResult = await geocodeWithBing(address)
  if (bingResult) {
    return { coords: bingResult, source: 'Bing' }
  }

  return null
}

// Simple geocode returning just coordinates (for backwards compat)
export async function geocode(address: string): Promise<[number, number] | null> {
  const result = await geocodeAddress(address)
  return result?.coords ?? null
}

// Fallback geocoding using zip or city/state
export async function geocodeFallback(
  city: string,
  state: string,
  zip: string
): Promise<GeocodeResult | null> {
  // Try zip code first (more specific)
  if (zip && zip.length === 5) {
    const zipResult = await geocodeWithNominatim(`${zip}, USA`)
    if (zipResult) {
      return { coords: zipResult, source: 'Nominatim (zip)' }
    }
  }

  // Try city, state
  if (city && state) {
    const cityResult = await geocodeWithNominatim(`${city}, ${state}, USA`)
    if (cityResult) {
      return { coords: cityResult, source: 'Nominatim (city)' }
    }
  }

  return null
}
