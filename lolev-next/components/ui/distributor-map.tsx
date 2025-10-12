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
import { useMapData } from '@/hooks/use-map-data';
import { useGeolocation } from '@/hooks/use-geolocation';
import { useLocationSearch } from '@/hooks/use-location-search';
import { MapControls } from '@/components/map/map-controls';
import { LocationCard } from '@/components/map/location-card';
import { useTheme } from 'next-themes';

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

interface GeoJSON {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

interface LocationWithDistance extends GeoFeature {
  distance?: number;
}

interface DistributorMapProps {
  className?: string;
  height?: string | number;
  showSearch?: boolean;
  initialZoom?: number;
  maxPoints?: number;
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
  maxPoints = 20
}: DistributorMapProps) {
  // Use custom hooks
  const { geoData, loading, error } = useMapData();
  const { userLocation, getUserLocation } = useGeolocation();
  const { searchTerm, setSearchTerm, searchLocation, isSearching } = useLocationSearch();
  const { theme } = useTheme();

  // Component state
  const [selectedLocation, setSelectedLocation] = useState<GeoFeature | null>(null);
  const [clickedLocation, setClickedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
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
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Update viewport when search location changes
  useEffect(() => {
    if (searchLocation) {
      setClickedLocation(null); // Clear clicked location when user searches
      setViewport({
        latitude: searchLocation.latitude,
        longitude: searchLocation.longitude,
        zoom: MAP_CONFIG.LOCATION_ZOOM
      });
    }
  }, [searchLocation]);

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
    setSearchTerm('');
    setClickedLocation(null);

    getUserLocation(
      (coords) => {
        setViewport({
          latitude: coords.latitude,
          longitude: coords.longitude,
          zoom: MAP_CONFIG.LOCATION_ZOOM
        });

        // Scroll list to top
        if (scrollAreaRef.current) {
          const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
          if (scrollContainer) {
            scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }

        toast.success(`Showing ${maxPoints} nearest locations`);
      }
    );
  }, [getUserLocation, setSearchTerm, maxPoints]);

  // Handle location click
  const handleLocationClick = useCallback((location: GeoFeature, fromMap: boolean = false) => {
    const [lng, lat] = location.geometry.coordinates;
    setSelectedLocation(location);

    // If clicking from map with no context, set clicked location to show nearby
    if (fromMap && !searchLocation && !userLocation) {
      setClickedLocation({ latitude: lat, longitude: lng });
      setSearchTerm('');
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
    return (
      <Card className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="text-center p-8">
          <div className="animate-spin h-12 w-12 border-4 border-primary/30 border-t-primary rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Loading locations...</p>
        </div>
      </Card>
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
      />

      {/* Split View */}
      <div className="flex flex-1 relative h-full overflow-hidden">
        {/* Map Side */}
        <div className={cn(
          "h-full relative border-r",
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
            <ScrollArea className="h-full" ref={scrollAreaRef}>
              <div className="p-4 space-y-3">
                {locationsWithDistance.map((location) => {
                  const isSelected = selectedLocation?.properties.uniqueId === location.properties.uniqueId;
                  return (
                    <LocationCard
                      key={location.properties.uniqueId}
                      name={location.properties.Name}
                      address={location.properties.address}
                      distance={location.distance}
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
                  {searchTerm ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Search className="h-10 w-10" />
                        </EmptyMedia>
                        <EmptyTitle>No locations found</EmptyTitle>
                        <EmptyDescription>
                          Try searching for a different name or address
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (searchLocation || userLocation) ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <MapPin className="h-10 w-10" />
                        </EmptyMedia>
                        <EmptyTitle>No locations nearby</EmptyTitle>
                        <EmptyDescription>
                          Try expanding your search area or search by name
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Locate className="h-10 w-10" />
                        </EmptyMedia>
                        <EmptyTitle>Find Lolev Near You</EmptyTitle>
                        <EmptyDescription>
                          Use "Near Me" or search by location, zipcode, or address to find nearby retailers
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <Button onClick={handleGeolocate} variant="default">
                          <Locate className="h-4 w-4 mr-2" />
                          Near Me
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
