/**
 * Beer-map list: default camera, distance from the selected taproom,
 * and search suggestions.
 */
import { describe, expect, it } from 'vitest'
import {
  cameraForLocation,
  cameraForTaproom,
  coordsFromDirectionsUrl,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  googleDirectionsUrl,
  lngLat,
  TAPROOM_ZOOM,
} from '@/lib/map/geo'
import {
  buildMapList,
  referenceFromTaproom,
  retailerPoints,
  taproomPoints,
  type MapPoint,
} from '@/lib/map/points'
import { mergeSuggestions, parseMapboxFeatures, storeNameSuggestions } from '@/lib/map/search'
import type { PayloadLocation } from '@/lib/types/location'

const lawrenceville = {
  id: '1',
  slug: 'lawrenceville',
  name: 'Lawrenceville',
  coordinates: [-79.960098, 40.465372] as [number, number],
  address: { street: '5247 Butler Street', city: 'Pittsburgh', state: 'PA', zip: '15201' },
} as PayloadLocation

const zelienople = {
  id: '2',
  slug: 'zelienople',
  name: 'Zelienople',
  coordinates: [-80.1367, 40.7945] as [number, number],
  address: { street: '111 South Main Street', city: 'Zelienople', state: 'PA', zip: '16063' },
} as PayloadLocation

const retailers: MapPoint[] = [
  {
    uniqueId: 'philly',
    name: '1 Stop Mini Market',
    address: '700 S 8th St, Philadelphia, PA',
    lng: -75.155, lat: 39.942, kind: 'retailer',
  },
  {
    uniqueId: 'moonlit',
    name: 'Moonlit Downtown',
    address: '1015 Forbes Ave, Pittsburgh, PA',
    lng: -79.993, lat: 40.438, kind: 'retailer',
  },
  {
    uniqueId: 'delivery',
    name: 'Beer To Your Door',
    address: 'Pittsburgh, PA',
    lng: -79.99, lat: 40.44, kind: 'retailer',
  },
]

describe('coordsFromDirectionsUrl', () => {
  it('reads lat/lng from a Google Maps place URL', () => {
    const coords = coordsFromDirectionsUrl(
      'https://www.google.com/maps/place/Lolev+Beer/@40.4816217,-79.9564325,821m',
    )
    expect(coords).toEqual({ lat: 40.4816217, lng: -79.9564325 })
  })
})

describe('cameraForTaproom', () => {
  it('centers on the taproom at neighborhood zoom', () => {
    expect(cameraForTaproom(lawrenceville.coordinates)).toEqual({
      latitude: 40.465372,
      longitude: -79.960098,
      zoom: TAPROOM_ZOOM,
    })
  })

  it('falls back to Pittsburgh, not a continental zoom', () => {
    expect(cameraForTaproom(null)).toEqual({ ...DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM })
    expect(DEFAULT_MAP_ZOOM).toBeGreaterThanOrEqual(8)
  })

  it('uses a directions URL when the point field is empty', () => {
    const camera = cameraForLocation({
      coordinates: null,
      address: {
        directionsUrl: 'https://www.google.com/maps/place/@40.7953254,-80.1372365,817m',
      },
    })
    expect(camera.latitude).toBeCloseTo(40.7953254)
    expect(camera.longitude).toBeCloseTo(-80.1372365)
    expect(camera.zoom).toBe(TAPROOM_ZOOM)
  })
})

describe('taproomPoints', () => {
  it('falls back to the directions URL when coordinates are missing', () => {
    const points = taproomPoints([
      {
        ...lawrenceville,
        coordinates: null,
        address: {
          ...lawrenceville.address,
          directionsUrl: 'https://www.google.com/maps/place/@40.4816217,-79.9564325,821m',
        },
      } as PayloadLocation,
    ])
    expect(points).toHaveLength(1)
    expect(points[0]?.lat).toBeCloseTo(40.4816217)
    expect(points[0]?.lng).toBeCloseTo(-79.9564325)
    expect(points[0]?.kind).toBe('taproom')
  })
})

describe('buildMapList', () => {
  it('sorts retailers by distance from the selected taproom, not A–Z', () => {
    const taprooms = taproomPoints([lawrenceville, zelienople])
    const reference = referenceFromTaproom(lawrenceville)
    const { items } = buildMapList({
      taprooms,
      retailers,
      reference,
      limit: 20,
    })

    expect(items[0]?.name).toBe('Lawrenceville')
    expect(items[0]?.kind).toBe('taproom')
    const names = items.filter((item) => item.kind === 'retailer').map((item) => item.name)
    expect(names[0]).not.toBe('1 Stop Mini Market')
    expect(names.indexOf('Moonlit Downtown')).toBeLessThan(names.indexOf('1 Stop Mini Market'))
  })

  it('includes taprooms with every retailer', () => {
    const taprooms = taproomPoints([lawrenceville])
    const { items, total } = buildMapList({
      taprooms,
      retailers,
      reference: referenceFromTaproom(lawrenceville),
      limit: 20,
    })
    expect(items.some((item) => item.kind === 'taproom')).toBe(true)
    expect(items.map((item) => item.name)).toContain('1 Stop Mini Market')
    expect(items.map((item) => item.name)).toContain('Moonlit Downtown')
    expect(total).toBe(4)
  })
})

describe('retailerPoints', () => {
  it('drops invalid coordinates and blank ids', () => {
    const points = retailerPoints([
      {
        geometry: { coordinates: [-79.99, 40.44] },
        properties: { uniqueId: 'ok', Name: 'Ok', address: 'A' },
      },
      {
        geometry: { coordinates: [200, 40] as [number, number] },
        properties: { uniqueId: 'bad', Name: 'Bad', address: 'B' },
      },
      {
        geometry: { coordinates: [-79.99, 40.44] },
        properties: { Name: 'No id', address: 'C' },
      },
    ])
    expect(points.map((p) => p.uniqueId)).toEqual(['ok'])
  })
})

describe('lngLat', () => {
  it('reads GeoJSON Point objects as well as arrays', () => {
    expect(lngLat({ coordinates: [-79.96, 40.46] })).toEqual({ lng: -79.96, lat: 40.46 })
    expect(googleDirectionsUrl('1 Main, Pittsburgh')).toContain('maps/dir/')
  })
})

describe('search suggestions', () => {
  it('matches store names and Mapbox places', () => {
    const stores = storeNameSuggestions('moon', retailers)
    expect(stores[0]?.label).toBe('Moonlit Downtown')
    expect(stores[0]?.kind).toBe('store')

    const places = parseMapboxFeatures([
      { id: 'place.1', text: 'Pittsburgh', place_name: 'Pittsburgh, Pennsylvania, United States', center: [-79.9959, 40.4406] },
    ])
    expect(places[0]).toMatchObject({ kind: 'place', label: 'Pittsburgh', longitude: -79.9959, latitude: 40.4406 })

    const merged = mergeSuggestions(stores, places, 'moon', 8)
    expect(merged[0]?.kind).toBe('store')
    expect(merged.some((s) => s.kind === 'place')).toBe(true)
    expect(mergeSuggestions(stores, places, '15201', 8)[0]?.kind).toBe('place')
    expect(mergeSuggestions(stores, places, 'Pittsburgh', 8)[0]?.kind).toBe('place')
  })
})
