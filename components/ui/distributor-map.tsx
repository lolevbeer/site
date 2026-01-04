'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import Map, {
  NavigationControl,
  FullscreenControl,
  ScaleControl,
  GeolocateControl,
  Source,
  Layer
} from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { MapPin, Locate, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useMapData } from '@/lib/hooks/use-map-data';
import { useGeolocation } from '@/lib/hooks/use-geolocation';
import { useLocationSearch } from '@/lib/hooks/use-location-search';
import { useLocationPreferences } from '@/lib/hooks/use-location-preferences';
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
  DETAIL_ZOOM: 15,
  CLUSTER_MAX_ZOOM: 12,
  CLUSTER_RADIUS: 60,
  EARTH_RADIUS_MILES: 3959,
  NEARBY_PREVIEW_COUNT: 3,
  NEARBY_TOTAL_COUNT: 10,
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
  maxPoints?: number;
  initialData?: GeoJSON;
}

const customerTypeColors: Record<string, string> = {
  'Home-D': '#10b981',
  'On Premise': '#8b5cf6',
  'Retail': '#f59e0b',
  'default': '#6b7280'
};

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

export function DistributorMap({
  className,
  height = 600,
  showSearch = true,
  initialZoom = 7,
  maxPoints = 20,
  initialData
}: DistributorMapProps) {
  // Use custom hooks - skip fetch if initialData provided
  const { geoData: fetchedData, loading: fetchLoading, error: fetchError } = useMapData();
  const { userLocation, getUserLocation } = useGeolocation();
  const { searchTerm, setSearchTerm, searchLocation, isSearching } = useLocationSearch();
  const { theme } = useTheme();

  // Location preferences for persistence
  const { preferences, isLoaded: prefsLoaded, saveGeolocationPreference, saveSearchPreference } = useLocationPreferences();

  // Use initialData if provided, otherwise use fetched data
  const geoData = initialData || fetchedData;
  const loading = !initialData && fetchLoading;
  const error = !initialData ? fetchError : null;

  // Component state
  const [selectedLocation, setSelectedLocation] = useState<GeoFeature | null>(null);
  const [clickedLocation, setClickedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');
  const [distanceFromLabel, setDistanceFromLabel] = useState<string | null>(null);
  const [hasAppliedPrefs, setHasAppliedPrefs] = useState(false);
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

  // Apply saved preferences on initial load
  useEffect(() => {
    if (prefsLoaded && !hasAppliedPrefs && preferences && geoData) {
      setHasAppliedPrefs(true);

      if (preferences.coordinates) {
        // Set viewport to saved location
        setViewport({
          latitude: preferences.coordinates.latitude,
          longitude: preferences.coordinates.longitude,
          zoom: MAP_CONFIG.LOCATION_ZOOM
        });

        // Set clicked location to enable distance calculations
        setClickedLocation(preferences.coordinates);

        // Set label based on preference type
        if (preferences.type === 'geolocation') {
          setDistanceFromLabel('your last location');
        } else if (preferences.type === 'search' && preferences.searchTerm) {
          const term = preferences.searchTerm;
          setDistanceFromLabel(term.length > 20 ? term.substring(0, 20) + '...' : term);
          setSearchTerm(term);
        }
      }
    }
  }, [prefsLoaded, hasAppliedPrefs, preferences, geoData, setSearchTerm]);

  // Update viewport when search location changes
  useEffect(() => {
    if (searchLocation) {
      setClickedLocation(null); // Clear clicked location when user searches
      setViewport({
        latitude: searchLocation.latitude,
        longitude: searchLocation.longitude,
        zoom: MAP_CONFIG.LOCATION_ZOOM
      });
      // Set distance label based on search term (zipcode or address)
      const trimmedSearch = searchTerm.trim();
      if (/^\d{5}$/.test(trimmedSearch)) {
        setDistanceFromLabel(trimmedSearch);
      } else {
        // Truncate long addresses
        setDistanceFromLabel(trimmedSearch.length > 20 ? trimmedSearch.substring(0, 20) + '...' : trimmedSearch);
      }
      // Save search preference
      saveSearchPreference(trimmedSearch, searchLocation);
    }
  }, [searchLocation, searchTerm, saveSearchPreference]);

  // Scroll to selected item
  useEffect(() => {
    if (selectedLocation && selectedCardRef.current) {
      selectedCardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [selectedLocation]);

  // Filter and sort locations - optimized
  const locationsWithDistance = useMemo(() => {
    if (!geoData) return [];

    // Only show locations if user has provided some context
    const hasContext = searchTerm || searchLocation || userLocation || clickedLocation;
    if (!hasContext) return [];

    let filtered = geoData.features;

    // Text search filter (only if not doing location search)
    if (searchTerm && !searchLocation) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(feature =>
        feature.properties.Name.toLowerCase().includes(term) ||
        feature.properties.address.toLowerCase().includes(term)
      );
    }

    // Calculate distances if we have a reference location
    const referenceLocation = searchLocation || userLocation || clickedLocation;
    if (referenceLocation) {
      const withDistances = filtered.map(location => {
        const [lng, lat] = location.geometry.coordinates;
        const distance = calculateDistance(
          referenceLocation.latitude,
          referenceLocation.longitude,
          lat,
          lng
        );
        return { ...location, distance };
      });
      // Sort by distance first, then limit
      return withDistances.sort((a, b) => (a.distance || 0) - (b.distance || 0)).slice(0, maxPoints);
    }

    // For text-only search without location, just limit results
    return filtered.slice(0, maxPoints) as LocationWithDistance[];
  }, [geoData, searchTerm, searchLocation, userLocation, clickedLocation, maxPoints]);

  // Get nearest locations for preview
  const nearbyLocations = useMemo(() => {
    if (searchLocation || userLocation || clickedLocation) {
      return locationsWithDistance.slice(0, MAP_CONFIG.NEARBY_TOTAL_COUNT);
    }
    return [];
  }, [locationsWithDistance, searchLocation, userLocation, clickedLocation]);

  // Handle geolocation
  const handleGeolocate = useCallback(() => {
    trackMapInteraction('geolocate');
    setSearchTerm('');
    setClickedLocation(null);

    getUserLocation(
      (coords) => {
        setViewport({
          latitude: coords.latitude,
          longitude: coords.longitude,
          zoom: MAP_CONFIG.LOCATION_ZOOM
        });
        setDistanceFromLabel('you');
        // Save geolocation preference
        saveGeolocationPreference(coords);
        toast.success(`Showing ${maxPoints} nearest locations`);
      }
    );
  }, [getUserLocation, setSearchTerm, maxPoints, saveGeolocationPreference]);

  // Handle location click
  const handleLocationClick = useCallback((location: GeoFeature, fromMap: boolean = false) => {
    const [lng, lat] = location.geometry.coordinates;
    trackMapInteraction('location_click', location.properties.Name);
    setSelectedLocation(location);

    // If clicking from map with no context, set clicked location to show nearby
    if (fromMap && !searchLocation && !userLocation) {
      setClickedLocation({ latitude: lat, longitude: lng });
      setSearchTerm('');
      // Truncate name for label
      const name = location.properties.Name;
      setDistanceFromLabel(name.length > 20 ? name.substring(0, 20) + '...' : name);
    }

    // Switch to list view on mobile to show selection
    setMobileView('list');

    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: MAP_CONFIG.DETAIL_ZOOM,
        duration: 1000,
        essential: true
      });
    }
  }, [searchLocation, userLocation, setSearchTerm]);

  // Create GeoJSON for clustering - always show all locations on map
  const clusteredGeoJSON = useMemo(() => {
    if (!geoData) return { type: 'FeatureCollection' as const, features: [] };

    // For map display, show all locations (clusters will handle performance)
    // Only limit the list view
    return {
      type: 'FeatureCollection' as const,
      features: geoData.features
    };
  }, [geoData]);

  if (!MAPBOX_TOKEN) {
    return (
      <Card className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="text-center p-8">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Map token not configured</p>
        </div>
      </Card>
    );
  }

  if (loading) {
    const containerHeight = typeof height === 'number' ? `${height}px` : height;
    return (
      <div className={cn('flex flex-col', className)} style={{ height: containerHeight, width: '100%' }}>
        {/* Skeleton Controls */}
        <Card className="border-0 flex-shrink-0 shadow-none">
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          </div>
        </Card>
        {/* Skeleton Split View */}
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
          <MapPin className="h-12 w-12 text-destructive mx-auto mb-4" />
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
        locationCount={locationsWithDistance.length}
        nearbyLocations={nearbyLocations.slice(0, MAP_CONFIG.NEARBY_PREVIEW_COUNT).map(loc => ({
          uniqueId: loc.properties.uniqueId || '',
          name: loc.properties.Name,
          distance: loc.distance
        }))}
        onNearMeClick={handleGeolocate}
        onNearbyLocationClick={(location) => {
          const fullLocation = nearbyLocations.find(loc => loc.properties.uniqueId === location.uniqueId);
          if (fullLocation) handleLocationClick(fullLocation);
        }}
        mobileView={mobileView}
        onMobileViewChange={setMobileView}
        showSearch={showSearch}
        distanceFromLabel={distanceFromLabel}
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
            mapStyle={theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11'}
            style={{ width: '100%', height: '100%' }}
            reuseMaps
            interactiveLayerIds={['clusters', 'unclustered-point']}
            onClick={(e) => {
              if (e.features && e.features.length > 0) {
                const feature = e.features[0];

                if (feature.properties?.cluster) {
                  const clusterId = feature.properties.cluster_id;
                  const mapboxMap = mapRef.current?.getMap();
                  if (mapboxMap) {
                    const source = mapboxMap.getSource('distributors') as any;
                    source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
                      if (!err) {
                        mapRef.current?.flyTo({
                          center: (feature.geometry as any).coordinates,
                          zoom: zoom + 1,
                          duration: 500
                        });
                      }
                    });
                  }
                } else {
                  // Try to find in filtered list first, otherwise search full dataset
                  let location = locationsWithDistance.find(loc =>
                    loc.properties.uniqueId === feature.properties?.uniqueId
                  );

                  if (!location && geoData) {
                    location = geoData.features.find(loc =>
                      loc.properties.uniqueId === feature.properties?.uniqueId
                    );
                  }

                  if (location) {
                    handleLocationClick(location, true);
                  }
                }
              }
            }}
          >
            <NavigationControl position="top-right" />
            <FullscreenControl position="top-right" />
            <ScaleControl />
            <GeolocateControl position="top-right" trackUserLocation showUserHeading />

            <Source
              id="distributors"
              type="geojson"
              data={clusteredGeoJSON}
              cluster={true}
              clusterMaxZoom={MAP_CONFIG.CLUSTER_MAX_ZOOM}
              clusterRadius={MAP_CONFIG.CLUSTER_RADIUS}
            >
              <Layer
                id="clusters"
                type="circle"
                filter={['has', 'point_count']}
                paint={{
                  'circle-color': [
                    'step',
                    ['get', 'point_count'],
                    '#51bbd6',
                    10,
                    '#f1f075',
                    30,
                    '#f28cb1'
                  ],
                  'circle-radius': [
                    'step',
                    ['get', 'point_count'],
                    20,
                    10,
                    25,
                    30,
                    30
                  ]
                }}
              />

              <Layer
                id="cluster-count"
                type="symbol"
                filter={['has', 'point_count']}
                layout={{
                  'text-field': '{point_count_abbreviated}',
                  'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                  'text-size': 12
                }}
                paint={{
                  'text-color': '#ffffff'
                }}
              />

              <Layer
                id="unclustered-point"
                type="circle"
                filter={['!', ['has', 'point_count']]}
                paint={{
                  'circle-color': [
                    'match',
                    ['get', 'customerType'],
                    'Home-D', customerTypeColors['Home-D'],
                    'On Premise', customerTypeColors['On Premise'],
                    'Retail', customerTypeColors['Retail'],
                    customerTypeColors.default
                  ],
                  'circle-radius': 6,
                  'circle-stroke-width': 1,
                  'circle-stroke-color': '#ffffff'
                }}
              />
            </Source>
          </Map>
        </div>

        {/* List Side */}
        <div className={cn(
          "h-full overflow-hidden",
          "md:w-1/2",
          mobileView === 'list' ? "w-full" : "hidden md:block"
        )}>
          {locationsWithDistance.length > 0 ? (
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                {locationsWithDistance.map((location) => {
                  const isSelected = selectedLocation?.properties.uniqueId === location.properties.uniqueId;
                  return (
                    <LocationCard
                      key={location.properties.uniqueId}
                      name={location.properties.Name}
                      address={location.properties.address}
                      distance={location.distance}
                      distanceFromLabel={distanceFromLabel}
                      isSelected={isSelected}
                      onClick={() => handleLocationClick(location)}
                      innerRef={isSelected ? selectedCardRef : undefined}
                    />
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-full p-4">
                  {searchTerm && !searchLocation ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Search className="h-10 w-10" />
                        </EmptyMedia>
                        <EmptyTitle>No matches for "{searchTerm}"</EmptyTitle>
                        <EmptyDescription>
                          We couldn't find any stores or bars matching that name.
                          Try a different search or use your location instead.
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <div className="flex gap-2">
                          <Button onClick={() => setSearchTerm('')} variant="outline" size="sm">
                            Clear Search
                          </Button>
                          <Button onClick={handleGeolocate} variant="default" size="sm">
                            <Locate className="h-4 w-4 mr-1" />
                            Near Me
                          </Button>
                        </div>
                      </EmptyContent>
                    </Empty>
                  ) : (searchLocation || userLocation) ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <MapPin className="h-10 w-10" />
                        </EmptyMedia>
                        <EmptyTitle>No retailers in this area</EmptyTitle>
                        <EmptyDescription>
                          We don't have any distribution partners near {distanceFromLabel || 'this location'} yet.
                          Try searching a different area or check back soon!
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <Button onClick={() => { setSearchTerm(''); setDistanceFromLabel(null); }} variant="outline" size="sm">
                          Search Different Area
                        </Button>
                      </EmptyContent>
                    </Empty>
                  ) : (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Locate className="h-10 w-10" />
                        </EmptyMedia>
                        <EmptyTitle>Find Lolev Near You</EmptyTitle>
                        <EmptyDescription>
                          Discover bars, restaurants, and stores that carry our beer.
                          Search by zipcode, city, or use your current location.
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <Button onClick={handleGeolocate} variant="default">
                          <Locate className="h-4 w-4 mr-2" />
                          Use My Location
                        </Button>
                      </EmptyContent>
                    </Empty>
                  )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DistributorMap;
