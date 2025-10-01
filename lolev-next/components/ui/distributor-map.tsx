'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Map, {
  Marker,
  NavigationControl,
  FullscreenControl,
  ScaleControl,
  GeolocateControl,
  Source,
  Layer
} from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MapPin, Navigation, Search, Filter, Store, Beer, X, List, Map as MapIcon, Locate } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

interface GeoFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    id: number;
    Name: string;
    address: string;
    customerType: string;
  };
}

interface GeoJSON {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

interface DistributorMapProps {
  className?: string;
  height?: string | number;
  showSearch?: boolean;
  showFilters?: boolean;
  initialZoom?: number;
  maxPoints?: number;
}

const customerTypeColors: Record<string, string> = {
  'Home-D': '#10b981', // green
  'On Premise': '#3b82f6', // blue
  'Retail': '#f59e0b', // amber
  'default': '#6b7280' // gray
};

export function DistributorMap({
  className,
  height = 600,
  showSearch = true,
  showFilters = true,
  initialZoom = 7,
  maxPoints = 500
}: DistributorMapProps) {
  const [geoData, setGeoData] = useState<GeoJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<GeoFeature | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'map' | 'list' | 'split'>('split');
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [nearbyLocations, setNearbyLocations] = useState<GeoFeature[]>([]);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchLocation, setSearchLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const mapRef = useRef<any>(null);
  const geolocateRef = useRef<any>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectedCardRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({
    latitude: 40.5285237,
    longitude: -80.2456463,
    zoom: initialZoom
  });

  // Trigger map resize when view mode changes
  useEffect(() => {
    if (mapRef.current) {
      // Single resize call after layout settles
      setTimeout(() => {
        mapRef.current?.resize();
      }, 200);
    }
  }, [viewMode]);

  // Scroll to selected item in list when selection changes
  useEffect(() => {
    if (selectedLocation && selectedCardRef.current && (viewMode === 'list' || viewMode === 'split')) {
      selectedCardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [selectedLocation, viewMode]);

  // Load GeoJSON data from both PA and NY
  useEffect(() => {
    // Start loading immediately
    const loadData = async () => {
      try {
        const [paResponse, nyResponse] = await Promise.all([
          fetch('/data/processed_geo_data.json'),
          fetch('/data/ny_geo_data.json')
        ]);

        const [paData, nyData] = await Promise.all([
          paResponse.json(),
          nyResponse.json()
        ]) as [GeoJSON, GeoJSON];

        // Add unique IDs to prevent duplicate key errors
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

        // Combine features from both datasets
        const combinedData: GeoJSON = {
          type: 'FeatureCollection',
          features: [...paFeatures, ...nyFeatures]
        };

        setGeoData(combinedData);
        setLoading(false);
      } catch (err) {
        console.error('Error loading geo data:', err);
        setError('Failed to load location data');
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter locations
  const filteredLocations = useMemo(() => {
    if (!geoData) return [];

    let filtered = geoData.features;

    // If we have a search location (zipcode/address was geocoded), don't filter by search term
    // Instead, show all locations which will be sorted by distance
    if (searchTerm && !searchLocation) {
      // Only do text filtering if we're NOT doing location-based search
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(feature =>
        feature.properties.Name.toLowerCase().includes(term) ||
        feature.properties.address.toLowerCase().includes(term)
      );
    }

    // Type filter always applies
    if (selectedType !== 'all') {
      filtered = filtered.filter(feature =>
        feature.properties.customerType === selectedType
      );
    }

    // Limit points for performance
    return filtered.slice(0, maxPoints);
  }, [geoData, searchTerm, selectedType, maxPoints, searchLocation]);

  // Get unique customer types
  const customerTypes = useMemo(() => {
    if (!geoData) return [];
    const types = new Set(geoData.features.map(f => f.properties.customerType));
    return Array.from(types).sort();
  }, [geoData]);

  // Calculate distance between two points (in miles)
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3959; // Radius of the Earth in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // Geocode address or zipcode using Mapbox
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

  // Sort locations by distance from user or search location
  const locationsWithDistance = useMemo(() => {
    const referenceLocation = searchLocation || userLocation;
    if (!referenceLocation || !filteredLocations.length) return filteredLocations;

    return filteredLocations.map(location => {
      const [lng, lat] = location.geometry.coordinates;
      const distance = calculateDistance(referenceLocation.latitude, referenceLocation.longitude, lat, lng);
      return { ...location, distance };
    }).sort((a: any, b: any) => a.distance - b.distance);
  }, [filteredLocations, userLocation, searchLocation, calculateDistance]);

  // Get nearest locations when user location changes
  useEffect(() => {
    const referenceLocation = searchLocation || userLocation;
    if (referenceLocation && locationsWithDistance.length) {
      setNearbyLocations(locationsWithDistance.slice(0, 10));
    }
  }, [userLocation, searchLocation, locationsWithDistance]);

  // Handle search term changes - detect zipcode/location and geocode
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Reset search location if search is cleared
    if (!searchTerm.trim()) {
      setSearchLocation(null);
      setIsSearching(false);
      return;
    }

    // Check if search term looks like a zipcode (5 digits) or contains location indicators
    const isZipcode = /^\d{5}$/.test(searchTerm.trim());
    const hasLocationIndicators = /\b(street|st|ave|avenue|rd|road|blvd|boulevard|city|state|[A-Z]{2})\b/i.test(searchTerm);
    const hasComma = searchTerm.includes(',');

    if (isZipcode || hasLocationIndicators || hasComma || searchTerm.trim().split(' ').length >= 2) {
      // Debounce geocoding requests
      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearching(true);
        const coords = await geocodeLocation(searchTerm);
        if (coords) {
          setSearchLocation(coords);
          // Pan map to the searched location
          setViewport({
            latitude: coords.latitude,
            longitude: coords.longitude,
            zoom: 10
          });
        }
        setIsSearching(false);
      }, 800); // Wait 800ms after user stops typing
    } else {
      // Regular name search - clear search location
      setSearchLocation(null);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, geocodeLocation]);

  // Handle geolocation
  const handleGeolocate = useCallback(() => {
    setLocationError(null);
    // Clear search when using geolocation
    setSearchTerm('');
    setSearchLocation(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ latitude, longitude });
        setLocationError(null);
        setViewport({
          latitude,
          longitude,
          zoom: 12
        });
      },
      (error) => {
        // Handle geolocation errors with user feedback
        let errorMessage = '';
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Please enable location access to find nearby locations';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
          default:
            errorMessage = 'Unable to get your location';
            break;
        }
        setLocationError(errorMessage);
        // Clear error after 5 seconds
        setTimeout(() => setLocationError(null), 5000);
      },
      {
        enableHighAccuracy: false, // Use false for faster response
        timeout: 5000,
        maximumAge: 60000 // Cache location for 1 minute
      }
    );
  }, []);

  // Handle location click from list
  const handleLocationClick = useCallback((location: GeoFeature) => {
    const [lng, lat] = location.geometry.coordinates;
    setSelectedLocation(location);
    setPopoverOpen(true);

    // Fly to the location with animation
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 15,
        duration: 1000,
        essential: true
      });
    } else {
      // Fallback if flyTo is not available
      setViewport({
        latitude: lat,
        longitude: lng,
        zoom: 15
      });
    }

    // On mobile, switch to map view when location is clicked
    if (window.innerWidth < 768 && viewMode === 'list') {
      setViewMode('map');
    }
  }, [viewMode]);

  // Create GeoJSON for clustering
  const clusteredGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: filteredLocations
  }), [filteredLocations]);

  if (!MAPBOX_TOKEN) {
    return (
      <Card className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="text-center p-8">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-2">Map token not configured</p>
          <p className="text-sm text-muted-foreground">
            Please add your Mapbox token to the .env.local file
          </p>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="text-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading locations...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="text-center p-8">
          <MapPin className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive font-medium mb-2">Error</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </Card>
    );
  }

  // Helper function to capitalize names properly
  const capitalizeName = (name: string) => {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Location List Component
  const LocationList = ({ locations }: { locations: any[] }) => (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        {locations.length > 0 ? (
          locations.map((location, index) => {
            const isSelected = selectedLocation &&
              selectedLocation.properties.uniqueId === location.properties.uniqueId;
            return (
            <Card
              key={location.properties.uniqueId || `${location.properties.id}_${index}`}
              ref={isSelected ? selectedCardRef : null}
              data-location-id={location.properties.uniqueId}
              className={cn(
                "p-3 cursor-pointer transition-all border-l-2",
                isSelected
                  ? "bg-background border-l-primary shadow-sm"
                  : "border-l-transparent hover:border-l-muted-foreground/20 hover:bg-muted/30"
              )}
              onClick={() => handleLocationClick(location)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{capitalizeName(location.properties.Name)}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {location.properties.address}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      variant="secondary"
                      className="text-xs"
                      style={{
                        backgroundColor: `${customerTypeColors[location.properties.customerType] || customerTypeColors.default}20`,
                        color: customerTypeColors[location.properties.customerType] || customerTypeColors.default
                      }}
                    >
                      {location.properties.customerType}
                    </Badge>
                    {location.distance !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {location.distance.toFixed(1)} mi
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      location.properties.address
                    )}`;
                    window.open(url, '_blank');
                  }}
                >
                  <Navigation className="h-4 w-4" />
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
  );

  const containerHeight = typeof height === 'number' ? `${height}px` : height;

  return (
    <div className={cn('flex flex-col', className)} style={{ height: containerHeight, width: '100%' }}>
      {/* Enhanced Controls Bar */}
      <Card className="rounded-b-none border-b-0 p-3 flex-shrink-0">
        <div className="flex flex-col gap-3">
          {/* View Mode Toggle and Location Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'map' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('map')}
                className="h-8"
              >
                <MapIcon className="h-4 w-4 mr-1" />
                Map
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8"
              >
                <List className="h-4 w-4 mr-1" />
                List
              </Button>
              <Button
                variant={viewMode === 'split' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('split')}
                className="h-8 hidden md:flex"
              >
                Split View
              </Button>
            </div>

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
              <div className="text-sm text-muted-foreground">
                {searchLocation ? (
                  <span>{locationsWithDistance.length} nearest locations</span>
                ) : (
                  <span>{locationsWithDistance.length} locations</span>
                )}
              </div>
            </div>
          </div>

          {/* Search and Filter Row */}
          {(showSearch || showFilters) && (
            <div className="flex flex-wrap gap-2">
              {showSearch && (
                <div className="relative flex-1 min-w-[150px]">
                  {isSearching ? (
                    <div className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4">
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                  ) : (
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  )}
                  <Input
                    placeholder="Search by name, zipcode, or address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                  {searchLocation && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                      <Badge variant="secondary" className="text-[10px] py-0">
                        <MapPin className="h-2 w-2 mr-1" />
                        Location
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {showFilters && customerTypes.length > 0 && (
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-[140px] h-8 text-sm">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {customerTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: customerTypeColors[type] || customerTypeColors.default }}
                          />
                          {type}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Location Error Message */}
          {locationError && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <MapPin className="h-3 w-3" />
              <span>{locationError}</span>
            </div>
          )}

          {/* Quick Access Nearest Locations (visible when user location or search location is available) */}
          {(userLocation || searchLocation) && nearbyLocations.length > 0 && viewMode !== 'list' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {searchLocation ? 'Nearest to search:' : 'Nearest to you:'}
              </span>
              {nearbyLocations.slice(0, 3).map((location: any, index: number) => (
                <Badge
                  key={location.properties.uniqueId || `nearest_${location.properties.id}_${index}`}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs whitespace-nowrap"
                  onClick={() => handleLocationClick(location)}
                >
                  {capitalizeName(location.properties.Name).substring(0, 20)}... ({location.distance.toFixed(1)}mi)
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Main Content Area */}
      <div className="rounded-t-none border-t-0 flex-1" style={{
        position: 'relative',
        height: 'calc(100% - 120px)', // Subtract controls height
        minHeight: '500px'
      }}>
        {viewMode === 'list' ? (
          // List only view
          <div className="h-full overflow-y-auto">
            <LocationList locations={locationsWithDistance} />
          </div>
        ) : (
          // Map or Split view
          <div className={cn(
            'flex flex-1 relative h-full',
            viewMode === 'split' ? '' : ''
          )}>
            {/* Map side */}
            <div className={cn(
              'h-full relative',
              viewMode === 'split' ? 'w-full md:w-1/2 border-r' : 'w-full'
            )}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
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
                    // Handle clicks on map layers
                    if (e.features && e.features.length > 0) {
                      const feature = e.features[0];

                      // Check if it's a cluster
                      if (feature.properties?.cluster) {
                        // Get the cluster expansion zoom
                        const clusterId = feature.properties.cluster_id;
                        const mapboxMap = mapRef.current?.getMap();
                        if (mapboxMap) {
                          const source = mapboxMap.getSource('distributors');
                          source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                            if (!err) {
                              mapRef.current?.flyTo({
                                center: feature.geometry.coordinates,
                                zoom: zoom + 1,
                                duration: 500
                              });
                            }
                          });
                        }
                      } else {
                        // It's an individual point - select it
                        const location = filteredLocations.find(loc =>
                          loc.properties.id === feature.properties.id ||
                          loc.properties.uniqueId === feature.properties.uniqueId
                        );
                        if (location) {
                          setSelectedLocation(location);
                          setPopoverOpen(true);
                        }
                      }
                    }
                  }}
                  onLoad={() => {
                    if (mapRef.current) {
                      mapRef.current.resize();

                      // Change cursor on hover over clickable layers
                      const map = mapRef.current.getMap();
                      map.on('mouseenter', 'clusters', () => {
                        map.getCanvas().style.cursor = 'pointer';
                      });
                      map.on('mouseleave', 'clusters', () => {
                        map.getCanvas().style.cursor = '';
                      });
                      map.on('mouseenter', 'unclustered-point', () => {
                        map.getCanvas().style.cursor = 'pointer';
                      });
                      map.on('mouseleave', 'unclustered-point', () => {
                        map.getCanvas().style.cursor = '';
                      });
                    }
                  }}
                  onError={(evt) => {
                    console.error('Map error:', evt);
                    if (evt.error?.status === 401 || evt.error?.status === 403) {
                      setError('Invalid Mapbox token. Please check your API key.');
                    }
                  }}
                >
          <NavigationControl position="top-right" />
          <FullscreenControl position="top-right" />
          <ScaleControl />
          <GeolocateControl
            position="top-right"
            trackUserLocation
            showUserHeading
          />

          {/* Cluster source and layers */}
          <Source
            id="distributors"
            type="geojson"
            data={clusteredGeoJSON}
            cluster={true}
            clusterMaxZoom={12}
            clusterRadius={60}
            clusterProperties={{}}
          >
            {/* Clustered points */}
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

            {/* Cluster count */}
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

            {/* Individual points */}
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

          {/* Individual markers for better interaction (show at medium to high zoom) */}
          {viewport.zoom > 11 && filteredLocations.slice(0, 100).map((location, index) => (
            <Marker
              key={location.properties.uniqueId || `${location.properties.id}_${index}`}
              latitude={location.geometry.coordinates[1]}
              longitude={location.geometry.coordinates[0]}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedLocation(location);
                setPopoverOpen(true);

                // If in split view, ensure the list scrolls to show this location
                if (viewMode === 'split') {
                  // Find the location in the list and trigger scroll
                  setTimeout(() => {
                    const element = document.querySelector(`[data-location-id="${location.properties.uniqueId}"]`);
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }, 100);
                }
              }}
            >
              <div className="cursor-pointer">
                <Beer
                  className="h-6 w-6"
                  style={{
                    color: customerTypeColors[location.properties.customerType] || customerTypeColors.default,
                    fill: 'currentColor'
                  }}
                />
              </div>
            </Marker>
          ))}

          {/* Always show marker for selected location when individual markers aren't visible */}
          {selectedLocation && viewport.zoom <= 11 && (
            <Marker
              latitude={selectedLocation.geometry.coordinates[1]}
              longitude={selectedLocation.geometry.coordinates[0]}
              anchor="bottom"
            >
              <div className="cursor-pointer animate-bounce">
                <Beer
                  className="h-8 w-8"
                  style={{
                    color: customerTypeColors[selectedLocation.properties.customerType] || customerTypeColors.default,
                    fill: 'currentColor',
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                  }}
                />
              </div>
            </Marker>
          )}

                {/* Popover for selected location */}
                {selectedLocation && (
                  <Marker
                    latitude={selectedLocation.geometry.coordinates[1]}
                    longitude={selectedLocation.geometry.coordinates[0]}
                    anchor="bottom"
                  >
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <PopoverTrigger asChild>
                        <div className="relative">
                          <div className="absolute inset-0" />
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px]" align="start" side="top" sideOffset={15}>
                        <div className="space-y-3">
                          <div>
                            <h3 className="font-semibold text-base leading-none">
                              {capitalizeName(selectedLocation.properties.Name)}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-2">
                              {selectedLocation.properties.address}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              style={{
                                backgroundColor: `${customerTypeColors[selectedLocation.properties.customerType] || customerTypeColors.default}20`,
                                color: customerTypeColors[selectedLocation.properties.customerType] || customerTypeColors.default
                              }}
                            >
                              {selectedLocation.properties.customerType}
                            </Badge>
                            {userLocation && (() => {
                              const [lng, lat] = selectedLocation.geometry.coordinates;
                              const distance = calculateDistance(userLocation.latitude, userLocation.longitude, lat, lng);
                              return (
                                <span className="text-xs text-muted-foreground">
                                  {distance.toFixed(1)} miles away
                                </span>
                              );
                            })()}
                          </div>

                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                selectedLocation.properties.address
                              )}`;
                              window.open(url, '_blank');
                            }}
                          >
                            <Navigation className="h-4 w-4 mr-2" />
                            Get Directions
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </Marker>
                )}
                </Map>
              </div>
            </div>
            {/* List side - only show in split view */}
            {viewMode === 'split' && (
              <div className="w-full md:w-1/2 h-full overflow-y-auto">
                <LocationList locations={locationsWithDistance} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DistributorMap;