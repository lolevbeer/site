'use client';

import React, { useState, useEffect } from 'react';
import Map, {
  Marker,
  NavigationControl,
  FullscreenControl,
  ScaleControl,
  GeolocateControl,
  Popup
} from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { MapPin, Navigation, Phone, Clock, AlertTriangle, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LocationSlug } from '@/lib/types/location';
import { useLocationContext } from '@/components/location/location-provider';
import { useTheme } from 'next-themes';

// You'll need to add your Mapbox access token to your environment variables
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

export interface LocationMarker {
  id: string;
  name: string;
  slug: LocationSlug;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  hours?: string;
  description?: string;
  directionsUrl?: string;
}

interface MapComponentProps {
  className?: string;
  height?: string | number;
  showControls?: boolean;
  showPopups?: boolean;
  selectedLocation?: LocationSlug;
  onLocationSelect?: (location: LocationSlug) => void;
  initialZoom?: number;
  style?: 'streets' | 'satellite' | 'light' | 'dark';
}

export function MapComponent({
  className,
  height = 400,
  showControls = true,
  showPopups = true,
  selectedLocation,
  onLocationSelect,
  initialZoom = 10,
  style = 'streets'
}: MapComponentProps) {
  const { resolvedTheme } = useTheme();
  const { locations: payloadLocations } = useLocationContext();
  const mapRef = React.useRef<any>(null);

  // Convert PayloadLocations to LocationMarkers
  // coordinates is a point field: [longitude, latitude]
  const locations: LocationMarker[] = payloadLocations
    .filter(loc => loc.coordinates && loc.coordinates.length === 2)
    .map(loc => {
      const [lng, lat] = loc.coordinates!;
      return {
        id: loc.id,
        name: `Lolev Beer - ${loc.name}`,
        slug: loc.slug || loc.id,
        latitude: lat,
        longitude: lng,
        address: loc.address?.street || '',
        city: loc.address?.city || '',
        state: loc.address?.state || 'PA',
        zipCode: loc.address?.zip || '',
        phone: loc.basicInfo?.phone ?? undefined,
        description: `Our location in ${loc.address?.city || loc.name}`,
        directionsUrl: loc.address?.directionsUrl ?? undefined
      };
    });

  // Calculate center point
  const centerLat = locations.length > 0
    ? locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length
    : 40.6322;
  const centerLng = locations.length > 0
    ? locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length
    : -80.0472;

  const [viewport, setViewport] = useState({
    latitude: centerLat,
    longitude: centerLng,
    zoom: initialZoom
  });
  const [selectedMarker, setSelectedMarker] = useState<LocationMarker | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  // Map style URLs - auto-switch between light/dark based on theme
  const mapStyles = {
    streets: resolvedTheme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12',
    satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
    light: 'mapbox://styles/mapbox/light-v11',
    dark: 'mapbox://styles/mapbox/dark-v11'
  };

  useEffect(() => {
    if (selectedLocation) {
      const location = locations.find(l => l.slug === selectedLocation);
      if (location) {
        setViewport({
          latitude: location.latitude,
          longitude: location.longitude,
          zoom: 14
        });
        setSelectedMarker(location);
      }
    }
  }, [selectedLocation, locations]);

  const handleMarkerClick = (location: LocationMarker) => {
    setSelectedMarker(location);
    setViewport({
      ...viewport,
      latitude: location.latitude,
      longitude: location.longitude,
      zoom: 14
    });
    onLocationSelect?.(location.slug);
  };

  const handleGetDirections = (location: LocationMarker) => {
    const url = location.directionsUrl || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      `${location.address}, ${location.city}, ${location.state} ${location.zipCode}`
    )}`;
    window.open(url, '_blank');
  };

  if (!MAPBOX_TOKEN) {
    return (
      <Empty className={cn(className)} style={{ height }}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Settings className="h-6 w-6" />
          </EmptyMedia>
          <EmptyTitle>Map token not configured</EmptyTitle>
          <EmptyDescription>
            Please add your Mapbox token to the .env.local file
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (mapError) {
    return (
      <Empty className={cn(className)} style={{ height }}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertTriangle className="h-6 w-6" />
          </EmptyMedia>
          <EmptyTitle>Map Error</EmptyTitle>
          <EmptyDescription>
            {mapError}. Please check your Mapbox token in .env.local
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (locations.length === 0) {
    return (
      <Empty className={cn(className)} style={{ height }}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MapPin className="h-6 w-6" />
          </EmptyMedia>
          <EmptyTitle>No locations available</EmptyTitle>
          <EmptyDescription>
            Location coordinates not configured
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)} style={{ height }}>
      <Map
        ref={mapRef}
        {...viewport}
        onMove={(evt) => setViewport(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={mapStyles[style]}
        style={{ width: '100%', height: '100%' }}
        reuseMaps
        onError={(evt) => {
          console.error('Map error:', evt);
          // Check error message for common issues
          const errorMsg = evt.error?.message || '';
          if (errorMsg.includes('401') || errorMsg.includes('403')) {
            setMapError('Invalid Mapbox token. Please check your API key.');
          } else {
            setMapError('Failed to load map. Please try again later.');
          }
        }}
      >
        {showControls && (
          <>
            <NavigationControl position="top-right" />
            <FullscreenControl position="top-right" />
            <ScaleControl />
            <GeolocateControl
              position="top-right"
              trackUserLocation
              showUserHeading
            />
          </>
        )}

        {locations.map((location) => (
          <Marker
            key={location.id}
            latitude={location.latitude}
            longitude={location.longitude}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleMarkerClick(location);
            }}
          >
            <div
              className={cn(
                'cursor-pointer transition-transform hover:scale-110',
                selectedMarker?.id === location.id && 'scale-125'
              )}
            >
              <MapPin
                className={cn(
                  'h-8 w-8',
                  selectedMarker?.id === location.id
                    ? 'text-primary fill-primary/20'
                    : 'text-red-600 fill-red-600/20'
                )}
              />
            </div>
          </Marker>
        ))}

        {showPopups && selectedMarker && (
          <Popup
            latitude={selectedMarker.latitude}
            longitude={selectedMarker.longitude}
            anchor="top"
            onClose={() => setSelectedMarker(null)}
            closeButton={true}
            closeOnClick={false}
            offset={-10}
          >
            <div className="p-2 min-w-[250px]">
              <h3 className="font-semibold text-sm mb-2">{selectedMarker.name}</h3>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <MapPin className="h-3 w-3 text-muted-foreground mt-0.5" />
                  <div>
                    <p>{selectedMarker.address}</p>
                    <p>{selectedMarker.city}, {selectedMarker.state} {selectedMarker.zipCode}</p>
                  </div>
                </div>

                {selectedMarker.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <a
                      href={`tel:${selectedMarker.phone}`}
                      className="text-primary hover:underline"
                    >
                      {selectedMarker.phone}
                    </a>
                  </div>
                )}

                {selectedMarker.hours && (
                  <div className="flex items-start gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground mt-0.5" />
                    <p className="text-muted-foreground">{selectedMarker.hours}</p>
                  </div>
                )}

                {selectedMarker.description && (
                  <p className="text-muted-foreground italic pt-2 border-t">
                    {selectedMarker.description}
                  </p>
                )}

                <Button
                  size="sm"
                  variant="default"
                  className="w-full mt-2"
                  onClick={() => handleGetDirections(selectedMarker)}
                >
                  <Navigation className="h-3 w-3 mr-1" />
                  Get Directions
                </Button>
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </Card>
  );
}

// Simplified map for smaller spaces
export function SimpleMap({
  locationSlug,
  height = 300,
  className
}: {
  locationSlug: LocationSlug;
  height?: number;
  className?: string;
}) {
  return (
    <MapComponent
      height={height}
      className={className}
      showControls={false}
      showPopups={false}
      selectedLocation={locationSlug}
      initialZoom={15}
    />
  );
}

export default MapComponent;
