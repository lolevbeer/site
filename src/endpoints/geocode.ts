/**
 * Server-side geocoding for distributor imports.
 *
 * `geocodeAddress` / `geocodeFallback` / `geocodeDistributor` are the US chain the
 * Encompass importer uses (Nominatim → Geocodio → Bing, then zip, then city+state).
 * `resolveDistributor` is the any-country chain the CSV importer uses: Mapbox (v6,
 * `permanent=true` because we store the pin) → Nominatim → Geocodio for US rows only.
 * It also returns the city / state / zip / country the provider found, so the importer
 * can fill blank cells, and whether the match is uncertain enough to review.
 */
import { sleep } from '@/src/utils/async'
import { formatFullAddress } from '@/lib/distributors/import-patch'
import { isStateCode } from '@/lib/distributors/fields'
import type { ResolvedParts } from '@/lib/distributors/fill-blank-parts'

const GEOCODIO_API_KEY = process.env.GEOCODIO_API_KEY || ''
const BING_MAPS_API_KEY = process.env.BING_MAPS_API_KEY || ''

/**
 * Nominatim allows one request per second. Every Nominatim call in the app goes
 * through here, so the importers need no sleeps of their own, and a caller that
 * spends time between requests (database writes, fallback providers) waits only
 * for whatever is left of the interval.
 *
 * ponytail: per-process timestamp; concurrent imports in separate serverless
 * instances are not coordinated. Add a shared store if imports ever run in parallel.
 */
const NOMINATIM_INTERVAL_MS = 1100
let nominatimReadyAt = 0

async function waitForNominatimSlot(): Promise<void> {
  const now = Date.now()
  const wait = nominatimReadyAt - now
  nominatimReadyAt = Math.max(now, nominatimReadyAt) + NOMINATIM_INTERVAL_MS
  if (wait > 0) await sleep(wait)
}

// Nominatim geocoding (free, rate limited 1 req/sec)
async function geocodeWithNominatim(address: string): Promise<[number, number] | null> {
  await waitForNominatimSlot()
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

// Geocodio fallback (requires API key)
async function geocodeWithGeocodio(address: string): Promise<[number, number] | null> {
  if (!GEOCODIO_API_KEY) return null

  const params = new URLSearchParams({
    q: address,
    country: 'USA',
    limit: '1',
  })

  try {
    const response = await fetch(`https://api.geocod.io/v2/geocode?${params}`, {
      headers: { Authorization: `Bearer ${GEOCODIO_API_KEY}` },
    })
    if (!response.ok) return null

    const data = await response.json()
    const location = data.results?.[0]?.location
    if (
      typeof location?.lat !== 'number' ||
      !Number.isFinite(location.lat) ||
      typeof location?.lng !== 'number' ||
      !Number.isFinite(location.lng)
    ) {
      return null
    }

    return [location.lng, location.lat]
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

// Geocode address: Nominatim first, then Geocodio and Bing fallbacks
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const nominatimResult = await geocodeWithNominatim(address)
  if (nominatimResult) {
    return { coords: nominatimResult, source: 'Nominatim' }
  }

  const geocodioResult = await geocodeWithGeocodio(address)
  if (geocodioResult) {
    return { coords: geocodioResult, source: 'Geocodio' }
  }

  const bingResult = await geocodeWithBing(address)
  if (bingResult) {
    return { coords: bingResult, source: 'Bing' }
  }

  return null
}

// Fallback geocoding using zip or city/state
export async function geocodeFallback(
  city: string,
  state: string,
  zip: string,
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

/**
 * Geocode a distributor the way every import does: the full street address
 * first (Nominatim, Geocodio, Bing), then the zip, then city + state. Returns
 * null only when all of those fail, so callers never need a made-up pin.
 */
export async function geocodeDistributor(parts: {
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}): Promise<[number, number] | null> {
  const full = await geocodeAddress(formatFullAddress(parts))
  if (full) return full.coords
  const fallback = await geocodeFallback(parts.city ?? '', parts.state ?? '', parts.zip ?? '')
  return fallback?.coords ?? null
}

type DistributorParts = {
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
}

export interface ResolvedDistributor {
  coords: [number, number]
  /** What the provider says the address is; the importer fills only blank cells. */
  parts: ResolvedParts
  source: 'Mapbox' | 'Nominatim' | 'Geocodio'
  /** True for a low-confidence or coarser-than-address match; the import report flags it. */
  uncertain: boolean
}

/** Drop empty strings so a part the provider did not return stays unset. */
function compact(parts: ResolvedParts): ResolvedParts {
  return Object.fromEntries(
    Object.entries(parts).filter(([, v]) => typeof v === 'string' && v.trim()),
  ) as ResolvedParts
}

type MapboxContext = Record<string, { name?: string; country_code?: string } | undefined>

// Mapbox v6 forward geocoding. Server-only secret token: the public map token is
// URL-restricted and is rejected without the site's Referer.
async function resolveWithMapbox(
  query: string,
  country: string | undefined,
): Promise<ResolvedDistributor | null> {
  const token = process.env.MAPBOX_GEOCODING_TOKEN
  if (!token) return null
  const params = new URLSearchParams({
    q: query,
    access_token: token,
    permanent: 'true',
    language: 'en',
    limit: '1',
  })
  if (country) params.set('country', country.toLowerCase())

  try {
    const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`)
    if (!response.ok) return null
    const feature = (await response.json()).features?.[0]
    const [lng, lat] = feature?.geometry?.coordinates ?? []
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
    const props = feature.properties ?? {}
    const context: MapboxContext = props.context ?? {}
    const confidence: string | undefined = props.match_code?.confidence
    return {
      coords: [lng, lat],
      parts: compact({
        city: context.place?.name,
        state: context.region?.name,
        zip: context.postcode?.name,
        country: context.country?.country_code?.toUpperCase(),
      }),
      source: 'Mapbox',
      uncertain: props.feature_type !== 'address' || !confidence || confidence === 'low',
    }
  } catch {
    return null
  }
}

type NominatimAddress = Record<string, string | undefined>

// Nominatim with structured parts; `countrycodes` only when the row's country is known.
async function resolveWithNominatim(
  query: string,
  country: string | undefined,
): Promise<ResolvedDistributor | null> {
  await waitForNominatimSlot()
  const params = new URLSearchParams({
    format: 'json',
    q: query,
    limit: '1',
    addressdetails: '1',
    'accept-language': 'en',
  })
  if (country) params.set('countrycodes', country.toLowerCase())

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'LolevBeer/1.0' },
    })
    if (!response.ok) return null
    const hit = (await response.json())[0]
    if (!hit) return null
    const lng = parseFloat(hit.lon)
    const lat = parseFloat(hit.lat)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
    const a: NominatimAddress = hit.address ?? {}
    return {
      coords: [lng, lat],
      parts: compact({
        city: a.city || a.town || a.village || a.municipality,
        state: a.state,
        zip: a.postcode,
        country: a.country_code?.toUpperCase(),
      }),
      source: 'Nominatim',
      uncertain: false,
    }
  } catch {
    return null
  }
}

/**
 * Locate a distributor in any country and report what the provider found.
 *
 * The row is treated as US when its country is `US`, or blank with a US state code.
 * A supplied country restricts every provider and any answer in another country is
 * discarded. Order: Mapbox, Nominatim (full address, then city + state), Geocodio (US
 * rows only). Returns null when nothing locates the row.
 */
export async function resolveDistributor(
  row: DistributorParts,
): Promise<ResolvedDistributor | null> {
  const state = row.state?.trim() || ''
  const country = row.country?.trim() || (isStateCode(state) ? 'US' : undefined)
  const query = formatFullAddress({ ...row, country })
  const sameCountry = (r: ResolvedDistributor | null) =>
    r && (!country || !r.parts.country || r.parts.country === country) ? r : null

  const mapbox = sameCountry(await resolveWithMapbox(query, country))
  if (mapbox) return mapbox

  const nominatim = sameCountry(await resolveWithNominatim(query, country))
  if (nominatim) return nominatim

  if (country === 'US') {
    const coords = await geocodeWithGeocodio(query)
    if (coords) return { coords, parts: {}, source: 'Geocodio', uncertain: false }
  }

  // Coarse fallback: the city (and state) alone puts the pin in the right town.
  const city = row.city?.trim()
  if (city) {
    const coarse = sameCountry(
      await resolveWithNominatim(formatFullAddress({ city, state, country }), country),
    )
    if (coarse) return { ...coarse, uncertain: true }
  }

  return null
}
