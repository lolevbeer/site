'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import Map, {
  NavigationControl,
  FullscreenControl,
  ScaleControl,
  GeolocateControl,
  Popup,
  Source,
  Layer
} from 'react-map-gl/mapbox';
import type { MapMouseEvent } from 'react-map-gl/mapbox';
import type { CircleLayer } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useMapData } from '@/lib/hooks/use-map-data';
import { useGeolocation } from '@/lib/hooks/use-geolocation';
import { useLocationSearch } from '@/lib/hooks/use-location-search';
import { MapControls } from '@/components/map/map-controls';
import { LocationCard } from '@/components/map/location-card';
import { LocationListSkeleton } from '@/components/map/location-card-skeleton';
import { useTheme } from 'next-themes';
import { trackMapInteraction } from '@/lib/analytics/events';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

// Map configuration constants
const MAP_CONFIG = {
  DEFAULT_CENTER: { latitude: 40.5285237, longitude: -80.2456463 },
  DEFAULT_ZOOM: 7,
  LOCATION_ZOOM: 12,
  DETAIL_ZOOM: 14,
  EARTH_RADIUS_MILES: 3959,
  NEARBY_PREVIEW_COUNT: 3,
  MAX_LIST_ITEMS: 20,
} as const;

interface GeoFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    id: number;
    Name: string;
    address: string;
    customerType: string;
    uniqueId?: string;
  };
}

interface LocationWithDistance extends GeoFeature {
  distance?: number;
}

interface GeoJSON {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

interface DistributorMapProps {
  className?: string;
  height?: string | number;
  showSearch?: boolean;
  initialZoom?: number;
  initialData?: GeoJSON;
  maxPoints?: number;
}

// Haversine distance calculation
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = MAP_CONFIG.EARTH_RADIUS_MILES;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Get directions URL
const getDirectionsUrl = (address: string) => {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
};

export function DistributorMap({
  className,
  height = 600,
  showSearch = true,
  initialZoom = 7,
  initialData
}: DistributorMapProps) {
  // Hooks
  const { geoData: fetchedData, loading: fetchLoading, error: fetchError } = useMapData();
  const { getUserLocation } = useGeolocation();
  const { searchTerm, setSearchTerm, searchLocation, isSearching } = useLocationSearch();
  const { resolvedTheme } = useTheme();

  // Use initialData if provided, otherwise use fetched data
  const geoData = initialData || fetchedData;
  const loading = !initialData && fetchLoading;
  const error = !initialData ? fetchError : null;

  // Unified reference location state (for distance calculations)
  const [referenceLocation, setReferenceLocation] = useState<{
    latitude: number;
    longitude: number;
    label: string;
  } | null>(null);

  // UI state
  const [selectedLocation, setSelectedLocation] = useState<GeoFeature | null>(null);
  const [popupLocation, setPopupLocation] = useState<GeoFeature | null>(null);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');
  const [viewport, setViewport] = useState<{
    latitude: number;
    longitude: number;
    zoom: number;
  }>({
    latitude: MAP_CONFIG.DEFAULT_CENTER.latitude,
    longitude: MAP_CONFIG.DEFAULT_CENTER.longitude,
    zoom: initialZoom
  });

  // Refs
  const mapRef = useRef<any>(null);
  const selectedCardRef = useRef<HTMLDivElement>(null);

  // Update reference location when search location changes
  useEffect(() => {
    if (searchLocation) {
      const trimmedSearch = searchTerm.trim();
      const label = /^\d{5}$/.test(trimmedSearch)
        ? trimmedSearch
        : trimmedSearch.length > 20
          ? trimmedSearch.substring(0, 20) + '...'
          : trimmedSearch;

      setReferenceLocation({
        latitude: searchLocation.latitude,
        longitude: searchLocation.longitude,
        label
      });

      setViewport({
        latitude: searchLocation.latitude,
        longitude: searchLocation.longitude,
        zoom: MAP_CONFIG.LOCATION_ZOOM
      });
    }
  }, [searchLocation, searchTerm]);

  // Scroll to selected card in list
  useEffect(() => {
    if (selectedLocation && selectedCardRef.current) {
      selectedCardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [selectedLocation]);

  // Calculate locations with distances
  const locationsWithDistance = useMemo(() => {
    if (!geoData) return [];

    let locations = geoData.features;

    // Text search filter (when not doing geocoded search)
    if (searchTerm && !searchLocation) {
      const term = searchTerm.toLowerCase();
      locations = locations.filter(feature =>
        feature.properties.Name.toLowerCase().includes(term) ||
        feature.properties.address.toLowerCase().includes(term)
      );
    }

    // Calculate distances if we have a reference location
    if (referenceLocation) {
      const withDistances = locations.map(location => {
        const [lng, lat] = location.geometry.coordinates;
        const distance = calculateDistance(
          referenceLocation.latitude,
          referenceLocation.longitude,
          lat,
          lng
        );
        return { ...location, distance };
      });
      return withDistances.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }

    // Sort alphabetically when no reference location
    return [...locations].sort((a, b) =>
      a.properties.Name.localeCompare(b.properties.Name)
    ) as LocationWithDistance[];
  }, [geoData, searchTerm, searchLocation, referenceLocation]);

  // Locations for list (limited)
  const listLocations = useMemo(() => {
    return locationsWithDistance.slice(0, MAP_CONFIG.MAX_LIST_ITEMS);
  }, [locationsWithDistance]);

  // Nearby locations for preview pills
  const nearbyLocations = useMemo(() => {
    if (!referenceLocation) return [];
    return locationsWithDistance.slice(0, MAP_CONFIG.NEARBY_PREVIEW_COUNT);
  }, [locationsWithDistance, referenceLocation]);

  // GeoJSON for map source - all locations for performant WebGL rendering
  const mapGeoJson = useMemo(() => {
    if (!geoData) return null;
    return {
      type: 'FeatureCollection' as const,
      features: geoData.features
    };
  }, [geoData]);

  // Layer styles - theme aware
  const pointLayer: CircleLayer = useMemo(() => ({
    id: 'distributor-points',
    type: 'circle',
    source: 'distributors',
    paint: {
      'circle-radius': 4,
      'circle-color': resolvedTheme === 'dark' ? '#ffffff' : '#000000',
      'circle-stroke-width': 1,
      'circle-stroke-color': resolvedTheme === 'dark' ? '#000000' : '#ffffff',
    },
  }), [resolvedTheme]);

  const selectedPointLayer: CircleLayer = useMemo(() => ({
    id: 'selected-point',
    type: 'circle',
    source: 'distributors',
    filter: ['==', ['get', 'uniqueId'], selectedLocation?.properties.uniqueId || ''],
    paint: {
      'circle-radius': 6,
      'circle-color': '#ea580c',
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff',
    },
  }), [selectedLocation]);

  // Handle geolocation
  const handleGeolocate = useCallback(() => {
    trackMapInteraction('geolocate');
    setSearchTerm('');

    getUserLocation((coords) => {
      setReferenceLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        label: 'you'
      });

      setViewport({
        latitude: coords.latitude,
        longitude: coords.longitude,
        zoom: MAP_CONFIG.LOCATION_ZOOM
      });

      toast.success('Showing nearest locations');
    });
  }, [getUserLocation, setSearchTerm]);

  // Handle map click on points
  const handleMapClick = useCallback((event: MapMouseEvent) => {
    const features = (event as any).features;
    if (!features || features.length === 0) {
      setPopupLocation(null);
      return;
    }

    const feature = features[0];
    if (feature.layer?.id === 'distributor-points' || feature.layer?.id === 'selected-point') {
      const clickedLocation: GeoFeature = {
        type: 'Feature',
        geometry: feature.geometry as GeoFeature['geometry'],
        properties: feature.properties as GeoFeature['properties']
      };
      trackMapInteraction('marker_click', clickedLocation.properties.Name);
      setPopupLocation(clickedLocation);
      setSelectedLocation(clickedLocation);
    }
  }, []);

  // Handle list card click - fly to location and show popup
  const handleCardClick = useCallback((location: GeoFeature) => {
    const [lng, lat] = location.geometry.coordinates;
    trackMapInteraction('card_click', location.properties.Name);
    setSelectedLocation(location);
    setPopupLocation(location);
    setMobileView('map');

    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: MAP_CONFIG.DETAIL_ZOOM,
        duration: 1000
      });
    }
  }, []);

  // Close popup
  const handleClosePopup = useCallback(() => {
    setPopupLocation(null);
  }, []);

  // Cursor style for interactive points
  const handleMouseEnter = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = 'pointer';
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = '';
    }
  }, []);

  // Error states
  if (!MAPBOX_TOKEN) {
    return (
      <Card className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="text-center p-8">
          <p className="text-muted-foreground">Map token not configured</p>
        </div>
      </Card>
    );
  }

  if (loading) {
    const containerHeight = typeof height === 'number' ? `${height}px` : height;
    return (
      <div className={cn('flex flex-col', className)} style={{ height: containerHeight, width: '100%' }}>
        <Card className="border-0 flex-shrink-0 shadow-none">
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          </div>
        </Card>
        <div className="flex flex-1 relative h-full overflow-hidden">
          <div className="hidden md:flex md:w-1/2 h-full items-center justify-center bg-muted/30">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          </div>
          <div className="w-full md:w-1/2 h-full overflow-hidden">
            <LocationListSkeleton count={8} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="text-center p-8">
          <p className="text-destructive font-medium">{error}</p>
        </div>
      </Card>
    );
  }

  const containerHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <div className={cn('flex flex-col', className)} style={{ height: containerHeight, width: '100%' }}>
      {/* Controls Bar */}
      <MapControls
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        isSearching={isSearching}
        hasSearchLocation={!!searchLocation}
        locationCount={listLocations.length}
        nearbyLocations={nearbyLocations.map(loc => ({
          uniqueId: loc.properties.uniqueId || '',
          name: loc.properties.Name,
          distance: loc.distance
        }))}
        onNearMeClick={handleGeolocate}
        onNearbyLocationClick={(location) => {
          const fullLocation = locationsWithDistance.find(loc => loc.properties.uniqueId === location.uniqueId);
          if (fullLocation) handleCardClick(fullLocation);
        }}
        mobileView={mobileView}
        onMobileViewChange={setMobileView}
        showSearch={showSearch}
        distanceFromLabel={referenceLocation?.label || null}
      />

      {/* Split View */}
      <div className="flex flex-1 relative h-full overflow-hidden">
        {/* Map Side */}
        <div className={cn(
          "h-full relative",
          "md:w-1/2",
          mobileView === 'map' ? "w-full" : "hidden md:block"
        )}>
          <Map
            ref={mapRef}
            {...viewport}
            onMove={(evt) => setViewport(evt.viewState)}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle={resolvedTheme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11'}
            style={{ width: '100%', height: '100%' }}
            reuseMaps
            interactiveLayerIds={['distributor-points', 'selected-point']}
            onClick={handleMapClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <NavigationControl position="top-right" />
            <FullscreenControl position="top-right" />
            <ScaleControl />
            <GeolocateControl position="top-right" trackUserLocation showUserHeading />

            {/* All points rendered via WebGL - performant for 1000s of points */}
            {mapGeoJson && (
              <Source id="distributors" type="geojson" data={mapGeoJson}>
                <Layer {...pointLayer} />
                <Layer {...selectedPointLayer} />
              </Source>
            )}

            {/* Popup for selected location */}
            {popupLocation && (
              <Popup
                latitude={popupLocation.geometry.coordinates[1]}
                longitude={popupLocation.geometry.coordinates[0]}
                anchor="top"
                onClose={handleClosePopup}
                closeButton={false}
                closeOnClick={false}
                offset={10}
                className="!p-0 [&_.mapboxgl-popup-content]:!p-0 [&_.mapboxgl-popup-content]:!bg-transparent [&_.mapboxgl-popup-content]:!shadow-none [&_.mapboxgl-popup-content]:!border-none [&_.mapboxgl-popup-content]:!rounded-none [&_.mapboxgl-popup-tip]:!hidden"
              >
                <Card className="min-w-[220px] max-w-[280px] shadow-lg border">
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-sm leading-tight">
                        {popupLocation.properties.Name}
                      </h3>
                      <button
                        onClick={handleClosePopup}
                        className="text-muted-foreground hover:text-foreground -mt-0.5 -mr-1 p-1"
                      >
                        <span className="sr-only">Close</span>
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      {popupLocation.properties.address}
                    </p>
                    <Button
                      size="sm"
                      variant="default"
                      className="w-full h-8 text-xs"
                      onClick={() => window.open(getDirectionsUrl(popupLocation.properties.address), '_blank')}
                    >
                      Get Directions
                    </Button>
                  </div>
                </Card>
              </Popup>
            )}
          </Map>
        </div>

        {/* List Side */}
        <div className={cn(
          "h-full overflow-hidden",
          "md:w-1/2",
          mobileView === 'list' ? "w-full" : "hidden md:block"
        )}>
          <ScrollArea className="h-full">
            <div className="py-4 md:pt-0 md:px-4 space-y-3">
              {listLocations.length > 0 ? (
                <>
                  {!referenceLocation && (
                    <Alert className="mb-3 border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
                      <Info className="h-4 w-4 text-amber-200 dark:text-amber-800" />
                      <AlertDescription className="text-muted-foreground">
                        Enter a location or use "Near Me" to see distances
                      </AlertDescription>
                    </Alert>
                  )}
                  {listLocations.map((location, index) => {
                    const isSelected = selectedLocation?.properties.uniqueId === location.properties.uniqueId;
                    return (
                      <div
                        key={location.properties.uniqueId || location.properties.id}
                        className="animate-stagger-in opacity-0"
                        style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}
                      >
                        <LocationCard
                          name={location.properties.Name}
                          address={location.properties.address}
                          distance={location.distance}
                          distanceFromLabel={referenceLocation?.label || null}
                          isSelected={isSelected}
                          onClick={() => handleCardClick(location)}
                          innerRef={isSelected ? selectedCardRef : undefined}
                        />
                      </div>
                    );
                  })}
                  {locationsWithDistance.length > MAP_CONFIG.MAX_LIST_ITEMS && (
                    <p className="text-center text-sm text-muted-foreground py-2">
                      Showing {MAP_CONFIG.MAX_LIST_ITEMS} of {locationsWithDistance.length} locations
                    </p>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full py-12">
                  <div className="text-center">
                    <p className="text-muted-foreground">No locations found</p>
                    {searchTerm && (
                      <Button
                        onClick={() => setSearchTerm('')}
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
  );
}

export default DistributorMap;
