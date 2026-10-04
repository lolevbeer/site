/**
 * Server-side geocoding for distributor imports.
 *
 * `resolveDistributor` locates a row in any country: Mapbox (v6, `permanent=true`
 * because we store the pin) → Nominatim → Geocodio for US rows only → the zip, then
 * the city alone. It also returns the city / state / zip / country the provider found,
 * so the importer can fill blank cells, and whether the match is uncertain enough to
 * review. `reverseDistributor` answers the same question for a row whose CSV gave the
 * pin. `geocodeDistributor` is the coords-only form both importers use for a pin.
 */
import { sleep } from '@/src/utils/async'
import { formatFullAddress } from '@/lib/distributors/import-patch'
import { isStateCode } from '@/lib/distributors/fields'
import type { ResolvedParts } from '@/lib/distributors/fill-blank-parts'

const GEOCODIO_API_KEY = process.env.GEOCODIO_API_KEY || ''

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

// Geocodio (US only; requires API key)
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
    return mapboxResult((await response.json()).features?.[0])
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
    return {
      coords: [lng, lat],
      parts: nominatimParts(hit.address),
      source: 'Nominatim',
      uncertain: false,
    }
  } catch {
    return null
  }
}

function mapboxResult(feature: {
  geometry?: { coordinates?: number[] }
  properties?: {
    feature_type?: string
    match_code?: { confidence?: string }
    context?: MapboxContext
  }
}): ResolvedDistributor | null {
  const [lng, lat] = feature?.geometry?.coordinates ?? []
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  const props = feature.properties ?? {}
  const context = props.context ?? {}
  const confidence = props.match_code?.confidence
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
}

function nominatimParts(a: NominatimAddress = {}): ResolvedParts {
  return compact({
    city: a.city || a.town || a.village || a.municipality,
    state: a.state,
    zip: a.postcode,
    country: a.country_code?.toUpperCase(),
  })
}

/**
 * What is at a known pin: the city, state, zip and country, for filling blank cells of
 * a row whose CSV gave latitude/longitude. Mapbox v6 reverse, then Nominatim reverse.
 * The returned `coords` are the provider's; callers keep their own pin.
 */
export async function reverseDistributor([lng, lat]: [
  number,
  number,
]): Promise<ResolvedDistributor | null> {
  const token = process.env.MAPBOX_GEOCODING_TOKEN
  if (token) {
    const params = new URLSearchParams({
      longitude: String(lng),
      latitude: String(lat),
      access_token: token,
      permanent: 'true',
      language: 'en',
      limit: '1',
    })
    try {
      const response = await fetch(`https://api.mapbox.com/search/geocode/v6/reverse?${params}`)
      if (response.ok) {
        const hit = mapboxResult((await response.json()).features?.[0])
        if (hit) return hit
      }
    } catch {
      // fall through to Nominatim
    }
  }

  await waitForNominatimSlot()
  const params = new URLSearchParams({
    format: 'json',
    lon: String(lng),
    lat: String(lat),
    addressdetails: '1',
    'accept-language': 'en',
  })
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { 'User-Agent': 'LolevBeer/1.0' },
    })
    if (!response.ok) return null
    const hit = await response.json()
    if (!hit?.address) return null
    return {
      coords: [lng, lat],
      parts: nominatimParts(hit.address),
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

  // Coarse fallbacks: the postcode, then the city (and state), put the pin in the right
  // area. Flagged uncertain so the report asks for a check.
  const zip = row.zip?.trim()
  if (zip) {
    const coarse = sameCountry(
      await resolveWithNominatim(
        formatFullAddress({ zip, country: country ?? undefined }),
        country,
      ),
    )
    if (coarse) return { ...coarse, uncertain: true }
  }

  // The city (and state) alone puts the pin in the right town.
  const city = row.city?.trim()
  if (city) {
    const coarse = sameCountry(
      await resolveWithNominatim(formatFullAddress({ city, state, country }), country),
    )
    if (coarse) return { ...coarse, uncertain: true }
  }

  return null
}

/**
 * Coords-only `resolveDistributor`, for callers that need just the pin (the Encompass
 * importer, and re-imports whose address changed). Null when nothing locates the row.
 */
export async function geocodeDistributor(
  parts: DistributorParts,
): Promise<[number, number] | null> {
  return (await resolveDistributor(parts))?.coords ?? null
}
