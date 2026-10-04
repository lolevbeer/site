import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function jsonResponse(data: unknown, ok = true) {
  return Response.json(data, {
    status: ok ? 200 : 503,
  })
}

describe('server-side geocoding provider fallbacks', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('GEOCODIO_API_KEY', 'test-geocodio-key')
    vi.stubEnv('BING_MAPS_API_KEY', undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('spaces Nominatim requests 1.1s apart, counting time already spent', async () => {
    vi.useFakeTimers()
    try {
      const sent: number[] = []
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>(async () => {
          sent.push(Date.now())
          return jsonResponse([{ lon: '-79.9', lat: '40.4' }])
        }),
      )
      const { geocodeAddress: geocode } = await import('@/src/endpoints/geocode')

      await geocode('a') // first request goes out immediately
      await vi.advanceTimersByTimeAsync(400) // caller spends 400ms on other work
      const second = geocode('b')
      await vi.advanceTimersByTimeAsync(699)
      expect(sent).toHaveLength(1) // still inside the 1.1s window
      await vi.advanceTimersByTimeAsync(1)
      await second
      expect(sent).toHaveLength(2)
      expect(sent[1] - sent[0]).toBe(1100) // waited only the remaining 700ms
    } finally {
      vi.useRealTimers()
    }
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
    vi.stubEnv('BING_MAPS_API_KEY', 'test-bing-key')
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

  it('geocodeDistributor falls back to the zip when the full address finds nothing', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse([])) // Nominatim, full address
        .mockResolvedValueOnce(jsonResponse({ results: [] })) // Geocodio, full address
        .mockResolvedValueOnce(jsonResponse([{ lon: '-79.95', lat: '40.44' }])) // Nominatim, zip
      vi.stubGlobal('fetch', fetchMock)

      const { geocodeDistributor } = await import('@/src/endpoints/geocode')
      const pending = geocodeDistributor({
        address: '123 Nowhere Ln',
        city: 'Pittsburgh',
        state: 'PA',
        zip: '15201',
      })
      await vi.advanceTimersByTimeAsync(5000)

      expect(await pending).toEqual([-79.95, 40.44])
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(decodeURIComponent(String(fetchMock.mock.calls[0][0]))).toContain(
        '123 Nowhere Ln, Pittsburgh PA 15201',
      )
      expect(decodeURIComponent(String(fetchMock.mock.calls[2][0]))).toContain('15201, USA')
    } finally {
      vi.useRealTimers()
    }
  })
})

/** A Mapbox v6 forward-geocode body with one feature. */
function mapboxV6(opts: {
  coords?: [number, number]
  featureType?: string
  confidence?: string
  context?: Record<string, Record<string, string>>
}) {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: opts.coords ?? [4.89, 52.37] },
        properties: {
          feature_type: opts.featureType ?? 'address',
          match_code: opts.confidence ? { confidence: opts.confidence } : undefined,
          context: opts.context ?? {
            postcode: { name: '1012 RR' },
            place: { name: 'Amsterdam' },
            region: { name: 'North Holland', region_code: 'NH' },
            country: { name: 'Netherlands', country_code: 'NL' },
          },
        },
      },
    ],
  }
}

describe('resolveDistributor', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('MAPBOX_GEOCODING_TOKEN', 'sk.test')
    vi.stubEnv('GEOCODIO_API_KEY', 'test-geocodio-key')
    vi.stubEnv('BING_MAPS_API_KEY', undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('asks Mapbox first for a storable, English result in the row country', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(mapboxV6({ confidence: 'exact' })))
    vi.stubGlobal('fetch', fetchMock)
    const { resolveDistributor } = await import('@/src/endpoints/geocode')

    const result = await resolveDistributor({
      address: 'Nieuwezijds Voorburgwal 250',
      country: 'NL',
    })

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(`${url.origin}${url.pathname}`).toBe('https://api.mapbox.com/search/geocode/v6/forward')
    expect(url.searchParams.get('permanent')).toBe('true')
    expect(url.searchParams.get('language')).toBe('en')
    expect(url.searchParams.get('country')).toBe('nl')
    expect(url.searchParams.get('access_token')).toBe('sk.test')
    expect(url.searchParams.get('q')).toBe('Nieuwezijds Voorburgwal 250, Netherlands')
    expect(result).toEqual({
      coords: [4.89, 52.37],
      parts: { city: 'Amsterdam', state: 'North Holland', zip: '1012 RR', country: 'NL' },
      source: 'Mapbox',
      uncertain: false,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('searches every country when the row has none, and fills it from the answer', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        mapboxV6({
          confidence: 'high',
          context: {
            place: { name: 'London' },
            region: { name: 'England' },
            country: { name: 'United Kingdom', country_code: 'GB' },
          },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { resolveDistributor } = await import('@/src/endpoints/geocode')

    const result = await resolveDistributor({ address: '47 High Street', city: 'Penge' })

    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.has('country')).toBe(false)
    expect(result?.parts).toEqual({ city: 'London', state: 'England', country: 'GB' })
  })

  it('flags a low-confidence or street-level match as uncertain', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse(mapboxV6({ confidence: 'low' })))
        .mockResolvedValueOnce(
          jsonResponse(
            mapboxV6({
              featureType: 'street',
              context: {
                place: { name: 'Busan' },
                country: { name: 'South Korea', country_code: 'KR' },
              },
            }),
          ),
        ),
    )
    const { resolveDistributor } = await import('@/src/endpoints/geocode')

    expect((await resolveDistributor({ address: 'a', country: 'NL' }))?.uncertain).toBe(true)
    expect((await resolveDistributor({ address: 'b', country: 'KR' }))?.uncertain).toBe(true)
  })

  it('discards an answer in a different country than the row supplied', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(mapboxV6({ confidence: 'high' }))) // NL, row says BE
      .mockResolvedValue(jsonResponse([])) // Nominatim fallbacks find nothing
    vi.stubGlobal('fetch', fetchMock)
    const { resolveDistributor } = await import('@/src/endpoints/geocode')

    const pending = resolveDistributor({ address: '1 Rue', city: 'Brussels', country: 'BE' })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await pending).toBeNull()
  })

  it('falls back to Nominatim in the row country and never calls Geocodio abroad', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ features: [] })) // Mapbox finds nothing
      .mockResolvedValueOnce(
        jsonResponse([
          {
            lon: '4.89',
            lat: '52.37',
            address: { city: 'Amsterdam', state: 'North Holland', country_code: 'nl' },
          },
        ]),
      )
    vi.stubGlobal('fetch', fetchMock)
    const { resolveDistributor } = await import('@/src/endpoints/geocode')

    const result = await resolveDistributor({ address: 'Dam 1', country: 'NL' })

    const url = new URL(String(fetchMock.mock.calls[1][0]))
    expect(url.hostname).toBe('nominatim.openstreetmap.org')
    expect(url.searchParams.get('countrycodes')).toBe('nl')
    expect(url.searchParams.get('accept-language')).toBe('en')
    expect(url.searchParams.get('addressdetails')).toBe('1')
    expect(result).toMatchObject({
      source: 'Nominatim',
      parts: { city: 'Amsterdam', state: 'North Holland', country: 'NL' },
    })
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('geocod.io'))).toBe(false)
  })

  it('skips Mapbox when no server token is set', async () => {
    vi.stubEnv('MAPBOX_GEOCODING_TOKEN', undefined)
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([{ lon: '4.89', lat: '52.37', address: {} }]))
    vi.stubGlobal('fetch', fetchMock)
    const { resolveDistributor } = await import('@/src/endpoints/geocode')

    expect((await resolveDistributor({ address: 'Dam 1', country: 'NL' }))?.source).toBe(
      'Nominatim',
    )
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('mapbox')
  })

  it('treats a row with a US state as US: Mapbox country=us, Geocodio allowed', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ features: [] })) // Mapbox
      .mockResolvedValueOnce(jsonResponse([])) // Nominatim
      .mockResolvedValueOnce(jsonResponse({ results: [{ location: { lat: 40.4, lng: -79.9 } }] }))
    vi.stubGlobal('fetch', fetchMock)
    const { resolveDistributor } = await import('@/src/endpoints/geocode')

    const result = await resolveDistributor({ address: '1 Main', city: 'Pittsburgh', state: 'PA' })

    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('country')).toBe('us')
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('countrycodes')).toBe('us')
    expect(result).toMatchObject({ coords: [-79.9, 40.4], source: 'Geocodio' })
  })
})

describe('reverseDistributor', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('MAPBOX_GEOCODING_TOKEN', 'sk.test')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('asks Mapbox what is at the pin, in English, storable', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(mapboxV6({ confidence: 'exact' })))
    vi.stubGlobal('fetch', fetchMock)
    const { reverseDistributor } = await import('@/src/endpoints/geocode')

    const result = await reverseDistributor([4.89, 52.37])

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(`${url.origin}${url.pathname}`).toBe('https://api.mapbox.com/search/geocode/v6/reverse')
    expect(url.searchParams.get('longitude')).toBe('4.89')
    expect(url.searchParams.get('latitude')).toBe('52.37')
    expect(url.searchParams.get('permanent')).toBe('true')
    expect(url.searchParams.get('language')).toBe('en')
    expect(result?.parts).toEqual({
      city: 'Amsterdam',
      state: 'North Holland',
      zip: '1012 RR',
      country: 'NL',
    })
  })

  it('falls back to Nominatim reverse when Mapbox has no token', async () => {
    vi.stubEnv('MAPBOX_GEOCODING_TOKEN', undefined)
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        lon: '4.89',
        lat: '52.37',
        address: { city: 'Amsterdam', country_code: 'nl' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { reverseDistributor } = await import('@/src/endpoints/geocode')

    const result = await reverseDistributor([4.89, 52.37])

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(`${url.origin}${url.pathname}`).toBe('https://nominatim.openstreetmap.org/reverse')
    expect(url.searchParams.get('accept-language')).toBe('en')
    expect(result?.parts).toEqual({ city: 'Amsterdam', country: 'NL' })
  })
})
