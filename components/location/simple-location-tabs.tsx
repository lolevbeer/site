/**
 * Simplified Location Tabs Component
 * Reduces complexity from 393 lines to ~100 lines following KISS principle
 */

'use client';

import React, { ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { Location, LocationDisplayNames } from '@/lib/types/location';
import { useLocationContext } from './location-provider';
import { ALL_LOCATIONS, isLocationOpen } from '@/lib/config/locations';

interface SimpleLocationTabsProps {
  children?: ReactNode;
  defaultLocation?: Location;
  showStatus?: boolean;
  onLocationChange?: (location: Location) => void;
  className?: string;
}

/**
 * Simplified Location Tabs
 * Core functionality without over-engineering
 */
export function SimpleLocationTabs({
  children,
  defaultLocation = Location.LAWRENCEVILLE,
  showStatus = false,
  onLocationChange,
  className
}: SimpleLocationTabsProps) {
  const { currentLocation, setLocation } = useLocationContext();

  const handleLocationChange = (value: string) => {
    const location = value as Location;
    setLocation(location);
    onLocationChange?.(location);
  };

  return (
    <Tabs
      value={currentLocation}
      defaultValue={defaultLocation}
      onValueChange={handleLocationChange}
      className={className}
    >
      <TabsList className="grid w-fit mx-auto grid-cols-2">
        {ALL_LOCATIONS.map((location) => (
          <TabsTrigger
            key={location}
            value={location}
            className="flex items-center gap-2"
          >
            <MapPin className="h-3 w-3" />
            {LocationDisplayNames[location]}
            {showStatus && (
              <StatusBadge
                status={isLocationOpen(location) ? 'open' : 'closed'}
                size="sm"
                showIcon={false}
              />
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {children || (
        <>
          {ALL_LOCATIONS.map((location) => (
            <TabsContent key={location} value={location}>
              <LocationContent location={location} />
            </TabsContent>
          ))}
        </>
      )}
    </Tabs>
  );
}

/**
 * Simple Location Content
 * Renders location-specific content
 */
interface LocationContentProps {
  location: Location;
  children?: ReactNode;
}

export function LocationContent({ location, children }: LocationContentProps) {
  const locationInfo = getLocationQuickInfo(location);

  if (children) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{LocationDisplayNames[location]}</h3>
        <StatusBadge
          status={isLocationOpen(location) ? 'open' : 'closed'}
        >
          {isLocationOpen(location) ? 'Open Now' : 'Closed'}
        </StatusBadge>
      </div>
      <p className="text-muted-foreground">{locationInfo.address}</p>
      <p className="text-sm">{locationInfo.phone}</p>
    </div>
  );
}

/**
 * Helper to get basic location info
 * Simplified from complex location data structure
 */
function getLocationQuickInfo(location: Location) {
  const info = {
    [Location.LAWRENCEVILLE]: {
      address: '125 41st St, Pittsburgh, PA 15201',
      phone: '(412) 586-4441'
    },
    [Location.ZELIENOPLE]: {
      address: '222 S Main St, Zelienople, PA 16063',
      phone: '(724) 452-0897'
    }
  };

  return info[location];
}