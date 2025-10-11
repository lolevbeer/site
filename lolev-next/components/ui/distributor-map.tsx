'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MapPin, Navigation, Search, Locate } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

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
  forceSplitView?: boolean;
}

const customerTypeColors: Record<string, string> = {
  'Home-D': '#10b981',
  'On Premise': '#8b5cf6',
  'Retail': '#f59e0b',
  'default': '#6b7280'
};

// Haversine distance calculation (memoized)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const capitalizeName = (name: string) => {
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export function DistributorMap({
  className,
  height = 600,
  showSearch = true,
  initialZoom = 7,
  maxPoints = 20,
  forceSplitView = false
}: DistributorMapProps) {
  const [geoData, setGeoData] = useState<GeoJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<GeoFeature | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [searchLocation, setSearchLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const mapRef = useRef<any>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectedCardRef = useRef<HTMLDivElement>(null);

  const [viewport, setViewport] = useState({
    latitude: 40.5285237,
    longitude: -80.2456463,
    zoom: initialZoom
  });

  // Load GeoJSON data once
  useEffect(() => {
    const loadData = async () => {
      try {
        const [paResponse, nyResponse] = await Promise.all([
          fetch('/processed_geo_data.json'),
          fetch('/ny_geo_data.json')
        ]);

        const [paData, nyData] = await Promise.all([
          paResponse.json(),
          nyResponse.json()
        ]) as [GeoJSON, GeoJSON];

        // Add unique IDs
        const paFeatures = paData.features.map((feature, index) => ({
          ...feature,
          properties: {
            ...feature.properties,
            uniqueId: `pa_${feature.properties.id}_${index}`
          }
        }));

        const nyFeatures = nyData.features.map((feature, index) => ({
          ...feature,
          properties: {
            ...feature.properties,
            uniqueId: `ny_${feature.properties.id}_${index}`
          }
        }));

        setGeoData({
          type: 'FeatureCollection',
          features: [...paFeatures, ...nyFeatures]
        });
        setLoading(false);
      } catch (err) {
        console.error('Error loading geo data:', err);
        setError('Failed to load location data');
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Geocode with debounce
  const geocodeLocation = useCallback(async (query: string) => {
    if (!MAPBOX_TOKEN || !query.trim()) return null;

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${MAPBOX_TOKEN}&country=US&limit=1`
      );

      if (!response.ok) return null;
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const [longitude, latitude] = data.features[0].center;
        return { latitude, longitude };
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
    return null;
  }, []);

  // Handle search term changes with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchTerm.trim()) {
      setSearchLocation(null);
      setIsSearching(false);
      return;
    }

    const isZipcode = /^\d{5}$/.test(searchTerm.trim());
    const hasLocationIndicators = /\b(street|st|ave|avenue|rd|road|blvd|boulevard|city|state|[A-Z]{2})\b/i.test(searchTerm);
    const hasComma = searchTerm.includes(',');

    if (isZipcode || hasLocationIndicators || hasComma || searchTerm.trim().split(' ').length >= 2) {
      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearching(true);
        const coords = await geocodeLocation(searchTerm);
        if (coords) {
          setSearchLocation(coords);
          setViewport({
            latitude: coords.latitude,
            longitude: coords.longitude,
            zoom: 10
          });
        }
        setIsSearching(false);
      }, 800);
    } else {
      setSearchLocation(null);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, geocodeLocation]);

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
    const referenceLocation = searchLocation || userLocation;
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

    // Limit for performance only when not searching by location
    return filtered.slice(0, maxPoints) as LocationWithDistance[];
  }, [geoData, searchTerm, searchLocation, userLocation, maxPoints]);

  // Get top 10 nearest locations
  const nearbyLocations = useMemo(() => {
    if (searchLocation || userLocation) {
      return locationsWithDistance.slice(0, 10);
    }
    return [];
  }, [locationsWithDistance, searchLocation, userLocation]);

  // Handle geolocation
  const handleGeolocate = useCallback(() => {
    setSearchTerm('');
    setSearchLocation(null);

    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ latitude, longitude });
        setViewport({ latitude, longitude, zoom: 12 });
        toast.success('Location found');
      },
      (error) => {
        const messages: Record<number, string> = {
          1: 'Please enable location access',
          2: 'Location unavailable',
          3: 'Location request timed out'
        };
        toast.error(messages[error.code] || 'Unable to get location');
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 60000
      }
    );
  }, []);

  // Handle location click
  const handleLocationClick = useCallback((location: GeoFeature) => {
    const [lng, lat] = location.geometry.coordinates;
    setSelectedLocation(location);
    setPopoverOpen(true);

    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 15,
        duration: 1000,
        essential: true
      });
    }
  }, []);

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
      <Card className="rounded-b-none border-0 border-b p-4 flex-shrink-0 shadow-none">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGeolocate}
                className="h-8"
              >
                <Locate className="h-4 w-4 mr-1" />
                Near Me
              </Button>
              <span className="text-sm text-muted-foreground">
                {locationsWithDistance.length} locations
              </span>
            </div>
          </div>

          {showSearch && (
            <div className="relative">
              {isSearching ? (
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              )}
              <Input
                placeholder="Search by name, zipcode, or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 bg-secondary"
              />
              {searchLocation && (
                <Badge variant="secondary" className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] py-0">
                  <MapPin className="h-2 w-2 mr-1" />
                  Location
                </Badge>
              )}
            </div>
          )}

          {nearbyLocations.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                <MapPin className="h-3 w-3 inline mr-1" />
                Nearest:
              </span>
              {nearbyLocations.slice(0, 3).map((location) => (
                <Badge
                  key={location.properties.uniqueId}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs whitespace-nowrap"
                  onClick={() => handleLocationClick(location)}
                >
                  {capitalizeName(location.properties.Name).substring(0, 25)}
                  {location.distance && <span className="ml-1 opacity-75">({location.distance.toFixed(1)}mi)</span>}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Split View */}
      <div className="flex flex-1 relative h-full overflow-hidden">
        {/* Map Side */}
        <div className="w-full md:w-1/2 h-full relative border-r">
          <Map
            ref={mapRef}
            {...viewport}
            onMove={(evt) => setViewport(evt.viewState)}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle="mapbox://styles/mapbox/light-v11"
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
                  const location = locationsWithDistance.find(loc =>
                    loc.properties.uniqueId === feature.properties?.uniqueId
                  );
                  if (location) {
                    setSelectedLocation(location);
                    setPopoverOpen(true);
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
              clusterMaxZoom={12}
              clusterRadius={60}
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
        <div className="w-full md:w-1/2 h-full overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {locationsWithDistance.length > 0 ? (
                locationsWithDistance.map((location) => {
                  const isSelected = selectedLocation?.properties.uniqueId === location.properties.uniqueId;
                  return (
                    <Card
                      key={location.properties.uniqueId}
                      ref={isSelected ? selectedCardRef : null}
                      className={cn(
                        "p-3 cursor-pointer transition-all border-0 shadow-none",
                        isSelected
                          ? "bg-primary/5"
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => handleLocationClick(location)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate">
                            {capitalizeName(location.properties.Name)}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1 uppercase">
                            {location.properties.address}
                          </p>
                          {location.distance !== undefined && (
                            <span className="text-xs font-medium text-primary mt-1 inline-block">
                              {location.distance.toFixed(1)} mi away
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs shrink-0 hover:bg-primary hover:text-primary-foreground cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(
                              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.properties.address)}`,
                              '_blank'
                            );
                          }}
                        >
                          <Navigation className="h-3 w-3 mr-1" />
                          Directions
                        </Button>
                      </div>
                    </Card>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No locations found</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Selected Location Popover */}
      {selectedLocation && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverContent className="w-[280px]">
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-base">
                  {capitalizeName(selectedLocation.properties.Name)}
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedLocation.properties.address}
                </p>
              </div>

              {userLocation && (() => {
                const [lng, lat] = selectedLocation.geometry.coordinates;
                const distance = calculateDistance(userLocation.latitude, userLocation.longitude, lat, lng);
                return (
                  <div className="text-sm font-medium text-primary">
                    {distance.toFixed(1)} miles away
                  </div>
                );
              })()}

              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedLocation.properties.address)}`,
                    '_blank'
                  );
                }}
              >
                <Navigation className="h-4 w-4 mr-2" />
                Get Directions
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export default DistributorMap;
