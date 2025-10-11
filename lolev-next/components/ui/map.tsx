'use client';

import React, { useState, useRef, useEffect } from 'react';
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
import { MapPin, Navigation, Phone, Clock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Location, LocationDisplayNames } from '@/lib/types/location';
import { useTheme } from 'next-themes';

// You'll need to add your Mapbox access token to your environment variables
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

export interface LocationMarker {
  id: string;
  name: string;
  location: Location;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  hours?: string;
  description?: string;
}

// Default brewery locations
const defaultLocations: LocationMarker[] = [
  {
    id: 'lawrenceville',
    name: 'Love of Lev - Lawrenceville',
    location: Location.LAWRENCEVILLE,
    latitude: 40.4698,
    longitude: -79.9576,
    address: '5104 Butler St',
    city: 'Pittsburgh',
    state: 'PA',
    zipCode: '15201',
    phone: '(412) 336-8965',
    hours: 'Mon-Thu: 4pm-10pm, Fri-Sat: 12pm-11pm, Sun: 12pm-8pm',
    description: 'Our original location in the heart of Lawrenceville'
  },
  {
    id: 'zelienople',
    name: 'Love of Lev - Zelienople',
    location: Location.ZELIENOPLE,
    latitude: 40.7945,
    longitude: -80.1367,
    address: '120 N Main St',
    city: 'Zelienople',
    state: 'PA',
    zipCode: '16063',
    phone: '(724) 772-2532',
    hours: 'Mon-Thu: 4pm-9pm, Fri-Sat: 12pm-10pm, Sun: 12pm-7pm',
    description: 'Our second location in historic downtown Zelienople'
  }
];

interface MapComponentProps {
  locations?: LocationMarker[];
  className?: string;
  height?: string | number;
  showControls?: boolean;
  showPopups?: boolean;
  selectedLocation?: Location;
  onLocationSelect?: (location: Location) => void;
  initialZoom?: number;
  style?: 'streets' | 'satellite' | 'light' | 'dark';
}

export function MapComponent({
  locations = defaultLocations,
  className,
  height = 400,
  showControls = true,
  showPopups = true,
  selectedLocation,
  onLocationSelect,
  initialZoom = 10,
  style = 'streets'
}: MapComponentProps) {
  const mapRef = useRef<any>(null);
  const { theme } = useTheme();
  const [viewport, setViewport] = useState({
    latitude: 40.6322, // Center between the two locations
    longitude: -80.0472,
    zoom: initialZoom
  });
  const [selectedMarker, setSelectedMarker] = useState<LocationMarker | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  // Map style URLs - auto-switch between light/dark based on theme
  const mapStyles = {
    streets: theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12',
    satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
    light: 'mapbox://styles/mapbox/light-v11',
    dark: 'mapbox://styles/mapbox/dark-v11'
  };

  useEffect(() => {
    if (selectedLocation) {
      const location = locations.find(l => l.location === selectedLocation);
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
    onLocationSelect?.(location.location);
  };

  const handleGetDirections = (location: LocationMarker) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      `${location.address}, ${location.city}, ${location.state} ${location.zipCode}`
    )}`;
    window.open(url, '_blank');
  };

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

  if (mapError) {
    return (
      <Card className={cn('flex items-center justify-center', className)} style={{ height }}>
        <div className="text-center p-8">
          <MapPin className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive font-medium mb-2">Map Error</p>
          <p className="text-sm text-muted-foreground mb-4">{mapError}</p>
          <p className="text-xs text-muted-foreground">
            Please check your Mapbox token in .env.local
          </p>
        </div>
      </Card>
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
          if (evt.error?.status === 403) {
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
            offsetTop={-10}
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
  location,
  height = 300,
  className
}: {
  location: Location;
  height?: number;
  className?: string;
}) {
  const locationData = defaultLocations.find(l => l.location === location);

  if (!locationData) return null;

  return (
    <MapComponent
      locations={[locationData]}
      height={height}
      className={className}
      showControls={false}
      showPopups={false}
      initialZoom={15}
    />
  );
}

export default MapComponent;