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
