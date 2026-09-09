'use client'

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import Map, {
  NavigationControl,
  FullscreenControl,
  ScaleControl,
  Popup,
  Source,
  Layer,
} from 'react-map-gl/mapbox'
import type { MapMouseEvent, MapRef } from 'react-map-gl/mapbox'
import type { CircleLayer } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X } from '@/components/icons'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { useMapData } from '@/lib/hooks/use-map-data'
import { useGeolocation } from '@/lib/hooks/use-geolocation'
import { useLocationSearch } from '@/lib/hooks/use-location-search'
import { MapControls } from '@/components/map/map-controls'
import { LocationCard } from '@/components/map/location-card'
import { LocationListSkeleton } from '@/components/map/location-card-skeleton'
import { useTheme } from 'next-themes'
import { trackMapInteraction } from '@/lib/analytics/events'
import { useLocationContext } from '@/components/location/location-provider'
import {
  cameraForLocation,
  DETAIL_ZOOM,
  googleDirectionsUrl,
  PLACE_ZOOM,
  TAPROOM_ZOOM,
} from '@/lib/map/geo'
import {
  buildMapList,
  referenceFromTaproom,
  retailerPoints,
  taproomPoints,
  type MapPoint,
  type ReferencePoint,
} from '@/lib/map/points'
import { mergeSuggestions, storeNameSuggestions, type PlaceSuggestion } from '@/lib/map/search'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ''

const MAP_CONFIG = {
  NEARBY_PREVIEW_COUNT: 3,
  MAX_LIST_ITEMS: 20,
} as const

interface GeoFeature {
  type: 'Feature'
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  properties: {
    id: number
    Name: string
    address: string
    uniqueId?: string
    kind?: string
  }
}

interface GeoJSON {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

interface DistributorMapProps {
  className?: string
  height?: string | number
  showSearch?: boolean
  initialData?: GeoJSON
}

function idFromUniqueId(uniqueId: string): number {
  let hash = 0
  for (let i = 0; i < uniqueId.length; i++) {
    hash = (hash * 31 + uniqueId.charCodeAt(i)) | 0
  }
  return Math.abs(hash) || 1
}

function pointToFeature(point: MapPoint): GeoFeature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
    properties: {
      id: idFromUniqueId(point.uniqueId),
      Name: point.name,
      address: point.address,
      uniqueId: point.uniqueId,
      kind: point.kind,
    },
  }
}

export function DistributorMap({
  className,
  height = 600,
  showSearch = true,
  initialData,
}: DistributorMapProps) {
  const { geoData: fetchedData, loading: fetchLoading, error: fetchError } = useMapData({
    enabled: !initialData,
  })
  const { getUserLocation } = useGeolocation()
  const { currentLocationData, locations, isClient } = useLocationContext()
  const taproomReference = useMemo(
    () => referenceFromTaproom(currentLocationData),
    [currentLocationData],
  )
  const [geoReference, setGeoReference] = useState<ReferencePoint | null>(null)
  const { resolvedTheme } = useTheme()
  const themeReady = resolvedTheme != null

  const geoData = initialData || fetchedData
  const loading = !initialData && fetchLoading
  const error = !initialData ? fetchError : null

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [popupPoint, setPopupPoint] = useState<MapPoint | null>(null)
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map')
  const [viewport, setViewport] = useState(() => cameraForLocation(currentLocationData))

  const mapRef = useRef<MapRef>(null)
  const selectedCardRef = useRef<HTMLDivElement>(null)
  const lastTaproomId = useRef<string | null>(null)
  const mountedRef = useRef(true)
  const geoGeneration = useRef(0)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const searchProximity = useMemo(() => {
    const reference = geoReference ?? taproomReference
    if (!reference) return null
    return { latitude: reference.latitude, longitude: reference.longitude }
  }, [geoReference, taproomReference])

  const {
    searchTerm,
    setSearchTerm,
    searchLocation,
    searchLabel,
    isSearching,
    placeSuggestions,
    selectPlace,
    commitTypedPlace,
    clearSearch,
  } = useLocationSearch(searchProximity)

  const searchReference = useMemo<ReferencePoint | null>(() => {
    if (!searchLocation) return null
    return {
      latitude: searchLocation.latitude,
      longitude: searchLocation.longitude,
      label: searchLabel || 'search',
    }
  }, [searchLocation, searchLabel])

  const referenceLocation = searchReference ?? geoReference ?? taproomReference

  const flyTo = useCallback((longitude: number, latitude: number, zoom: number, duration = 1200) => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [longitude, latitude],
        zoom,
        duration,
        curve: 1.42,
        easing: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
      })
    } else {
      setViewport({ latitude, longitude, zoom })
    }
  }, [])

  useEffect(() => {
    if (searchLocation) {
      flyTo(searchLocation.longitude, searchLocation.latitude, PLACE_ZOOM, 1500)
    }
  }, [searchLocation, flyTo])

  useEffect(() => {
    if (!isClient) return
    if (searchLocation || geoReference) return
    const taproomId = currentLocationData?.slug || currentLocationData?.id || null
    if (taproomId === lastTaproomId.current) return
    const isFirst = lastTaproomId.current === null
    lastTaproomId.current = taproomId
    if (isFirst) return
    const camera = cameraForLocation(currentLocationData)
    flyTo(camera.longitude, camera.latitude, camera.zoom, 800)
  }, [isClient, currentLocationData, searchLocation, geoReference, flyTo])

  const taprooms = useMemo(() => taproomPoints(locations), [locations])
  const retailers = useMemo(
    () => retailerPoints(geoData?.features ?? []),
    [geoData],
  )

  const sortedLocations = useMemo(
    () =>
      buildMapList({
        taprooms,
        retailers,
        reference: referenceLocation,
        limit: Number.MAX_SAFE_INTEGER,
      }),
    [taprooms, retailers, referenceLocation],
  )
  const allVisible = sortedLocations.items
  const locationTotal = sortedLocations.total
  const listLocations = useMemo(
    () => allVisible.slice(0, MAP_CONFIG.MAX_LIST_ITEMS),
    [allVisible],
  )

  const nearbyLocations = useMemo(() => {
    if (!referenceLocation) return []
    return listLocations
      .filter((point) => point.kind === 'retailer')
      .slice(0, MAP_CONFIG.NEARBY_PREVIEW_COUNT)
  }, [listLocations, referenceLocation])

  const storeSuggestions = useMemo(
    () => storeNameSuggestions(searchTerm, allVisible),
    [searchTerm, allVisible],
  )
  const suggestions = useMemo(
    () => mergeSuggestions(storeSuggestions, placeSuggestions, searchTerm),
    [storeSuggestions, placeSuggestions, searchTerm],
  )
  const mapGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: allVisible.map(pointToFeature),
    }),
    [allVisible],
  )

  const pointLayer: CircleLayer = useMemo(
    () => ({
      id: 'distributor-points',
      type: 'circle',
      source: 'distributors',
      filter: ['!=', ['get', 'kind'], 'taproom'],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3, 10, 5, 15, 8],
        'circle-color': resolvedTheme === 'dark' ? '#ffffff' : '#000000',
        'circle-stroke-width': 1,
        'circle-stroke-color': resolvedTheme === 'dark' ? '#000000' : '#ffffff',
        'circle-opacity': 0.85,
      },
    }),
    [resolvedTheme],
  )

  const taproomLayer: CircleLayer = useMemo(
    () => ({
      id: 'taproom-points',
      type: 'circle',
      source: 'distributors',
      filter: ['==', ['get', 'kind'], 'taproom'],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 6, 10, 10, 15, 14],
        'circle-color': '#ea580c',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 1,
      },
    }),
    [],
  )

  const selectedPointLayer: CircleLayer = useMemo(
    () => ({
      id: 'selected-point',
      type: 'circle',
      source: 'distributors',
      filter: ['==', ['get', 'uniqueId'], selectedId || '__none__'],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 8, 10, 12, 15, 16],
        'circle-color': '#ea580c',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 1,
      },
    }),
    [selectedId],
  )

  const handleGeolocate = useCallback(() => {
    trackMapInteraction('geolocate')
    clearSearch()
    const generation = ++geoGeneration.current

    getUserLocation((coords) => {
      if (!mountedRef.current || generation !== geoGeneration.current) return
      setGeoReference({
        latitude: coords.latitude,
        longitude: coords.longitude,
        label: 'you',
      })
      flyTo(coords.longitude, coords.latitude, TAPROOM_ZOOM, 1500)
      toast.success('Showing nearest locations')
    })
  }, [getUserLocation, clearSearch, flyTo])

  const handleClearSearch = useCallback(() => {
    clearSearch()
    const rest = geoReference ?? taproomReference
    if (rest) flyTo(rest.longitude, rest.latitude, TAPROOM_ZOOM, 800)
  }, [clearSearch, flyTo, geoReference, taproomReference])

  const selectPoint = useCallback(
    (point: MapPoint, source: 'marker' | 'card') => {
      trackMapInteraction(source === 'marker' ? 'marker_click' : 'card_click', point.name)
      setSelectedId(point.uniqueId)
      setPopupPoint(point)
      if (source === 'marker') setMobileView('map')
      flyTo(point.lng, point.lat, DETAIL_ZOOM)
    },
    [flyTo],
  )

  const handleMapClick = useCallback(
    (event: MapMouseEvent) => {
      const features = event.features
      if (!features || features.length === 0) {
        setPopupPoint(null)
        setSelectedId(null)
        return
      }
      const feature = features[0]
      const uniqueId = String(feature.properties?.uniqueId || '')
      const point = allVisible.find((item) => item.uniqueId === uniqueId)
      if (point) selectPoint(point, 'marker')
    },
    [allVisible, selectPoint],
  )

  const handleSelectSuggestion = useCallback(
    (suggestion: PlaceSuggestion) => {
      if (suggestion.kind === 'store' && suggestion.uniqueId) {
        const point = allVisible.find((item) => item.uniqueId === suggestion.uniqueId)
        if (point) selectPoint(point, 'card')
        return
      }
      selectPlace(suggestion)
    },
    [allVisible, selectPlace, selectPoint],
  )

  const handleMapLoad = useCallback(() => {
    if (searchLocation || geoReference) return
    const camera = cameraForLocation(currentLocationData)
    mapRef.current?.jumpTo({
      center: [camera.longitude, camera.latitude],
      zoom: camera.zoom,
    })
  }, [currentLocationData, searchLocation, geoReference])

  useEffect(() => {
    if (selectedId && selectedCardRef.current) {
      selectedCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [selectedId])

  const handleMouseEnter = useCallback(() => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = 'pointer'
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = ''
  }, [])

  if (!MAPBOX_TOKEN) {
    return (
      <Card className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="text-center p-8" role="status">
          <p className="text-muted-foreground">Map token not configured</p>
        </div>
      </Card>
    )
  }

  if (loading) {
    const containerHeight = typeof height === 'number' ? `${height}px` : height
    return (
      <div
        className={cn('flex flex-col', className)}
        style={{ height: containerHeight, width: '100%' }}
      >
        <Card className="border-0 flex-shrink-0 shadow-none">
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          </div>
        </Card>
        <div className="flex flex-1 relative h-full overflow-hidden">
          <div className="hidden md:flex md:w-1/2 h-full items-center justify-center bg-muted/30">
            <div className="text-center" role="status">
              <div className="animate-spin h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          </div>
          <div className="w-full md:w-1/2 h-full overflow-hidden">
            <LocationListSkeleton count={8} />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="text-center p-8" role="alert">
          <p className="text-destructive font-medium">{error}</p>
        </div>
      </Card>
    )
  }

  const containerHeight = typeof height === 'number' ? `${height}px` : height
  const mapStyle =
    resolvedTheme === 'dark'
      ? 'mapbox://styles/mapbox/dark-v11'
      : 'mapbox://styles/mapbox/light-v11'

  return (
    <div
      className={cn('flex flex-col', className)}
      style={{ height: containerHeight, width: '100%' }}
    >
      <MapControls
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        isSearching={isSearching}
        suggestions={suggestions}
        onSelectSuggestion={handleSelectSuggestion}
        onCommitSearch={async () => {
          const term = searchTerm.trim()
          if (!term) return
          const ok = await commitTypedPlace()
          if (!ok) toast.error('Could not find that place')
        }}
        locationCount={listLocations.length}
        locationTotal={locationTotal}
        nearbyLocations={nearbyLocations.map((loc) => ({
          uniqueId: loc.uniqueId,
          name: loc.name,
          distance: loc.distance,
        }))}
        onNearMeClick={handleGeolocate}
        onNearbyLocationClick={(location) => {
          const point = listLocations.find((item) => item.uniqueId === location.uniqueId)
          if (point) selectPoint(point, 'card')
        }}
        mobileView={mobileView}
        onMobileViewChange={setMobileView}
        showSearch={showSearch}
        distanceFromLabel={referenceLocation?.label || null}
      />

      <div className="flex flex-1 relative h-full overflow-hidden">
        <div
          className={cn(
            'h-full relative transition-all duration-300 ease-out',
            'md:w-1/2',
            mobileView === 'map' ? 'w-full opacity-100' : 'hidden md:block md:opacity-100',
          )}
        >
          {themeReady ? (
            <Map
              ref={mapRef}
              {...viewport}
              onMove={(evt) => setViewport(evt.viewState)}
              mapboxAccessToken={MAPBOX_TOKEN}
              mapStyle={mapStyle}
              style={{ width: '100%', height: '100%' }}
              reuseMaps
              interactiveLayerIds={['distributor-points', 'taproom-points', 'selected-point']}
              onClick={handleMapClick}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onLoad={handleMapLoad}
            >
              <NavigationControl position="top-right" />
              <FullscreenControl position="top-right" />
              <ScaleControl />

              <Source id="distributors" type="geojson" data={mapGeoJson}>
                <Layer {...pointLayer} />
                <Layer {...taproomLayer} />
                <Layer {...selectedPointLayer} />
              </Source>

              {popupPoint && (
                <Popup
                  latitude={popupPoint.lat}
                  longitude={popupPoint.lng}
                  anchor="top"
                  onClose={() => setPopupPoint(null)}
                  closeButton={false}
                  closeOnClick={false}
                  offset={10}
                  className="!p-0 [&_.mapboxgl-popup-content]:!p-0 [&_.mapboxgl-popup-content]:!bg-transparent [&_.mapboxgl-popup-content]:!shadow-none [&_.mapboxgl-popup-content]:!border-none [&_.mapboxgl-popup-content]:!rounded-none [&_.mapboxgl-popup-tip]:!hidden animate-in fade-in-0 zoom-in-95 duration-200"
                >
                  <Card className="min-w-[220px] max-w-[280px] shadow-lg border animate-in slide-in-from-top-2 duration-300">
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-sm leading-tight">
                          {popupPoint.name}
                          {popupPoint.kind === 'taproom' ? (
                            <span className="ml-2 text-[10px] uppercase tracking-wider text-primary">
                              Taproom
                            </span>
                          ) : null}
                        </p>
                        <button
                          type="button"
                          onClick={() => setPopupPoint(null)}
                          className="text-muted-foreground hover:text-foreground -mt-0.5 -mr-1 p-1 min-h-6 min-w-6"
                        >
                          <span className="sr-only">Close</span>
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{popupPoint.address}</p>
                      <Button size="sm" variant="default" className="w-full h-8 text-xs" asChild>
                        <a
                          href={googleDirectionsUrl(popupPoint.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Get Directions
                        </a>
                      </Button>
                    </div>
                  </Card>
                </Popup>
              )}
            </Map>
          ) : (
            <div className="h-full w-full bg-muted/30" role="status">
              <span className="sr-only">Loading map</span>
            </div>
          )}
        </div>

        <div
          className={cn(
            'h-full overflow-hidden transition-all duration-300 ease-out',
            'md:w-1/2',
            mobileView === 'list' ? 'w-full opacity-100' : 'hidden md:block md:opacity-100',
          )}
        >
          <ScrollArea className="h-full">
            <div className="py-4 md:pt-0 md:px-4">
              {listLocations.length > 0 ? (
                <>
                  <ul className="space-y-3">
                    {listLocations.map((location, index) => {
                      const isSelected = selectedId === location.uniqueId
                      return (
                        <li
                          key={location.uniqueId}
                          className="animate-stagger-in opacity-0"
                          style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}
                        >
                          <LocationCard
                            name={location.name}
                            address={location.address}
                            distance={location.distance}
                            distanceFromLabel={referenceLocation?.label || null}
                            isSelected={isSelected}
                            onClick={() => selectPoint(location, 'card')}
                            innerRef={isSelected ? selectedCardRef : undefined}
                            badge={location.kind === 'taproom' ? 'Taproom' : undefined}
                          />
                        </li>
                      )
                    })}
                  </ul>
                  {locationTotal > MAP_CONFIG.MAX_LIST_ITEMS && (
                    <p className="text-center text-sm text-muted-foreground py-2">
                      Showing {MAP_CONFIG.MAX_LIST_ITEMS} of {locationTotal} locations
                    </p>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full py-12">
                  <div className="text-center">
                    <p className="text-muted-foreground">No locations found</p>
                    {searchTerm && (
                      <Button
                        onClick={handleClearSearch}
                        variant="link"
                        size="sm"
                        className="mt-2"
                      >
                        Clear search
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

export default DistributorMap
