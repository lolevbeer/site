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
import { effectiveCountry } from '@/lib/distributors/country'
import { lngLat } from '@/lib/map/geo'
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
  region?: string | null
}

interface ResolvedDistributor {
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

/** `[lng, lat]` when both are finite and in range, else null. */
function pin(lng: unknown, lat: unknown): [number, number] | null {
  const point = lngLat([Number(lng), Number(lat)])
  return point && [point.lng, point.lat]
}

type MapboxContext = Record<string, { name?: string; country_code?: string } | undefined>

/**
 * One Mapbox v6 request (`forward` or `reverse`), English, `permanent=true` because we
 * store the pin. Server-only secret token: the public map token is URL-restricted and
 * is rejected without the site's Referer. Null without a token, a hit, or on error.
 */
async function mapboxFetch(
  endpoint: 'forward' | 'reverse',
  query: Record<string, string>,
): Promise<ResolvedDistributor | null> {
  const token = process.env.MAPBOX_GEOCODING_TOKEN
  if (!token) return null
  const params = new URLSearchParams({
    ...query,
    access_token: token,
    permanent: 'true',
    language: 'en',
    limit: '1',
  })
  try {
    const response = await fetch(`https://api.mapbox.com/search/geocode/v6/${endpoint}?${params}`)
    if (!response.ok) return null
    const feature = (await response.json()).features?.[0]
    const coords = pin(feature?.geometry?.coordinates?.[0], feature?.geometry?.coordinates?.[1])
    if (!coords) return null
    const props = feature.properties ?? {}
    const context: MapboxContext = props.context ?? {}
    const confidence: string | undefined = props.match_code?.confidence
    return {
      coords,
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

type NominatimHit = { lon?: string; lat?: string; address?: Record<string, string | undefined> }

/** One paced Nominatim request (`search` or `reverse`) with English address parts. */
async function nominatimFetch(
  endpoint: 'search' | 'reverse',
  query: Record<string, string>,
): Promise<ResolvedDistributor | null> {
  await waitForNominatimSlot()
  const params = new URLSearchParams({
    ...query,
    format: 'json',
    addressdetails: '1',
    'accept-language': 'en',
  })
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/${endpoint}?${params}`, {
      headers: { 'User-Agent': 'LolevBeer/1.0' },
    })
    if (!response.ok) return null
    const body = await response.json()
    const hit: NominatimHit | undefined = Array.isArray(body) ? body[0] : body
    const coords = pin(hit?.lon, hit?.lat)
    if (!coords) return null
    const a = hit?.address ?? {}
    return {
      coords,
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

/** Forward search; `countrycodes` only when the row's country is known. */
function nominatimSearch(q: string, country: string | undefined) {
  return nominatimFetch('search', {
    q,
    limit: '1',
    ...(country ? { countrycodes: country.toLowerCase() } : {}),
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
  const at = { longitude: String(lng), latitude: String(lat) }
  return (
    (await mapboxFetch('reverse', at)) ??
    (await nominatimFetch('reverse', { lon: at.longitude, lat: at.latitude }))
  )
}

/**
 * Locate a distributor in any country and report what the provider found.
 *
 * The row's country comes from `effectiveCountry` (blank with a US state means US). A
 * known country restricts every provider and any answer in another country is
 * discarded. Order: Mapbox, Nominatim, Geocodio (US rows only), then the zip and the
 * city alone, which are flagged uncertain. Returns null when nothing locates the row.
 */
export async function resolveDistributor(
  row: DistributorParts,
): Promise<ResolvedDistributor | null> {
  const country = effectiveCountry(row)
  const sameCountry = (r: ResolvedDistributor | null) =>
    r && (!country || !r.parts.country || r.parts.country === country) ? r : null
  const query = formatFullAddress({ ...row, country })

  const precise =
    sameCountry(
      await mapboxFetch('forward', {
        q: query,
        ...(country ? { country: country.toLowerCase() } : {}),
      }),
    ) ?? sameCountry(await nominatimSearch(query, country))
  if (precise) return precise

  if (country === 'US') {
    const coords = await geocodeWithGeocodio(query)
    if (coords) return { coords, parts: {}, source: 'Geocodio', uncertain: false }
  }

  // Coarse fallbacks put the pin in the right area; flagged so the report asks for a check
  const zip = row.zip?.trim()
  const city = row.city?.trim()
  const coarse = [zip && { zip, country }, city && { city, state: row.state, country }]
  for (const parts of coarse) {
    if (!parts) continue
    const hit = sameCountry(await nominatimSearch(formatFullAddress(parts), country))
    if (hit) return { ...hit, uncertain: true }
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
