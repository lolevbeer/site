/**
 * Location Tabs Component
 * Tab component for switching between brewery locations
 */

'use client';

import React, { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Location, LocationDisplayNames } from '@/lib/types/location';
import { useLocationContext } from './location-provider';
import { ALL_LOCATIONS, getLocationInfo, isLocationOpen } from '@/lib/config/locations';
import { MapPin, Clock, CheckCircle } from 'lucide-react';

interface LocationTabsProps {
  className?: string;
  children?: ReactNode;
  syncWithGlobalState?: boolean;
}

export function LocationTabs({
  className,
  children,
  syncWithGlobalState = false
}: LocationTabsProps) {
  const { currentLocation, setLocation, isClient } = useLocationContext();

  const handleValueChange = (newValue: string) => {
    const location = newValue as Location;
    if (syncWithGlobalState && Object.values(Location).includes(location)) {
      setLocation(location);
    }
  };

  // Prevent hydration mismatch by not rendering until client-side
  if (!isClient) {
    return (
      <div className={cn("w-full", className)}>
        <div className="grid w-fit mx-auto grid-cols-2 h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          {ALL_LOCATIONS.map((location) => (
            <div
              key={location}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium"
            >
              {LocationDisplayNames[location]}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Tabs
      value={currentLocation}
      onValueChange={handleValueChange}
      className={cn("w-full", className)}
    >
      <TabsList className="grid w-fit mx-auto grid-cols-2">
        {ALL_LOCATIONS.map((location) => (
          <TabsTrigger key={location} value={location} className="text-sm font-medium">
            {LocationDisplayNames[location]}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}

interface LocationTabContentProps {
  location: Location;
  children: ReactNode;
  className?: string;
}

export function LocationTabContent({
  location,
  children,
  className
}: LocationTabContentProps) {
  return (
    <TabsContent value={location} className={cn("mt-4", className)}>
      {children}
    </TabsContent>
  );
}

interface LocationInfoCardProps {
  location: Location;
  className?: string;
  showHours?: boolean;
  showContact?: boolean;
}

export function LocationInfoCard({
  location,
  className,
  showHours = true,
  showContact = true
}: LocationInfoCardProps) {
  const { hours } = useLocationContext();
  const locationInfo = getLocationInfo(location);
  const locationIsOpen = isLocationOpen(location);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              {LocationDisplayNames[location]}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {locationInfo.address}, {locationInfo.city}, {locationInfo.state} {locationInfo.zipCode}
            </p>
          </div>
          <StatusBadge
            status={locationIsOpen ? 'available' : 'unavailable'}
            type="availability"
            customLabel={locationIsOpen ? 'Open Now' : 'Closed'}
            icon={locationIsOpen ? CheckCircle : Clock}
            showIcon
            size="sm"
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {showHours && (
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Hours
            </h4>
            <div className="space-y-1 text-sm">
              {hours.getAllHours().map((day) => (
                <div
                  key={day.day}
                  className={cn(
                    "flex justify-between",
                    day.isToday && "font-medium text-primary"
                  )}
                >
                  <span>{day.day}</span>
                  <span>{day.hours}</span>
                </div>
              ))}
              {locationInfo.hours.notes && (
                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                  {locationInfo.hours.notes}
                </p>
              )}
            </div>
          </div>
        )}

        {showContact && (
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Contact
            </h4>
            <div className="space-y-2 text-sm">
              {locationInfo.phone && (
                <div>
                  <span className="text-muted-foreground">Phone: </span>
                  <a
                    href={`tel:${locationInfo.phone}`}
                    className="text-primary hover:underline"
                  >
                    {locationInfo.phone}
                  </a>
                </div>
              )}
              {locationInfo.email && (
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  <a
                    href={`mailto:${locationInfo.email}`}
                    className="text-primary hover:underline"
                  >
                    {locationInfo.email}
                  </a>
                </div>
              )}
              {locationInfo.parking && (
                <div>
                  <span className="text-muted-foreground">Parking: </span>
                  <span className="text-xs">{locationInfo.parking}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}