import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalGeocodioKey = process.env.GEOCODIO_API_KEY
const originalBingKey = process.env.BING_MAPS_API_KEY

function jsonResponse(data: unknown, ok = true) {
  return new Response(JSON.stringify(data), {
    status: ok ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('server-side geocoding provider fallbacks', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.GEOCODIO_API_KEY = 'test-geocodio-key'
    delete process.env.BING_MAPS_API_KEY
  })

  afterEach(() => {
    vi.unstubAllGlobals()

    if (originalGeocodioKey === undefined) delete process.env.GEOCODIO_API_KEY
    else process.env.GEOCODIO_API_KEY = originalGeocodioKey

    if (originalBingKey === undefined) delete process.env.BING_MAPS_API_KEY
    else process.env.BING_MAPS_API_KEY = originalBingKey
  })

  it('uses Geocodio when Nominatim cannot geocode the address', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse({
          results: [{ location: { lat: 40.465372, lng: -79.960098 } }],
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const { geocodeAddress } = await import('@/src/endpoints/geocode')
    const result = await geocodeAddress('123 Main St, Pittsburgh, PA 15201')

    expect(result).toEqual({
      coords: [-79.960098, 40.465372],
      source: 'Geocodio',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const [url, init] = fetchMock.mock.calls[1]
    const requestUrl = new URL(String(url))
    expect(`${requestUrl.origin}${requestUrl.pathname}`).toBe('https://api.geocod.io/v2/geocode')
    expect(requestUrl.searchParams.get('q')).toBe('123 Main St, Pittsburgh, PA 15201')
    expect(requestUrl.searchParams.get('country')).toBe('USA')
    expect(requestUrl.searchParams.get('limit')).toBe('1')
    expect(init).toMatchObject({
      headers: { Authorization: 'Bearer test-geocodio-key' },
    })
  })

  it('keeps Bing as the final fallback when Geocodio fails', async () => {
    process.env.BING_MAPS_API_KEY = 'test-bing-key'
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({}, false))
      .mockResolvedValueOnce(
        jsonResponse({
          resourceSets: [{ resources: [{ point: { coordinates: [40.44, -79.99] } }] }],
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const { geocodeAddress } = await import('@/src/endpoints/geocode')
    const result = await geocodeAddress('456 Penn Ave, Pittsburgh, PA 15222')

    expect(result).toEqual({ coords: [-79.99, 40.44], source: 'Bing' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[1][0])).toContain('https://api.geocod.io/v2/geocode?')
    expect(String(fetchMock.mock.calls[2][0])).toContain(
      'https://dev.virtualearth.net/REST/v1/Locations?',
    )
  })

  it('does not call a fallback when Nominatim succeeds', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([{ lon: '-79.98', lat: '40.45' }]))
    vi.stubGlobal('fetch', fetchMock)

    const { geocodeAddress } = await import('@/src/endpoints/geocode')
    const result = await geocodeAddress('789 Butler St, Pittsburgh, PA 15201')

    expect(result).toEqual({ coords: [-79.98, 40.45], source: 'Nominatim' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
