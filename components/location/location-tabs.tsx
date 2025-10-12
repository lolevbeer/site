/**
 * Location Tabs Component
 * Simplified tab component for location-based content
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
  defaultValue?: Location;
  value?: Location;
  onValueChange?: (location: Location) => void;
  children?: ReactNode;
  orientation?: 'horizontal' | 'vertical';
  syncWithGlobalState?: boolean;
}

export function LocationTabs({
  className,
  defaultValue,
  value,
  onValueChange,
  children,
  orientation = 'horizontal',
  syncWithGlobalState = false
}: LocationTabsProps) {
  const { currentLocation, setLocation } = useLocationContext();

  // When syncing with global state, always use currentLocation as the controlled value
  // to prevent switching between controlled/uncontrolled modes during hydration
  const controlledValue = syncWithGlobalState ? currentLocation : value;
  const controlledDefaultValue = syncWithGlobalState ? currentLocation : defaultValue;

  const handleValueChange = (newValue: string) => {
    const location = newValue as Location;
    if (Object.values(Location).includes(location)) {
      if (syncWithGlobalState) {
        setLocation(location);
      }
      onValueChange?.(location);
    }
  };

  // Use controlled or uncontrolled mode, not both
  const tabsProps = controlledValue !== undefined
    ? { value: controlledValue, onValueChange: handleValueChange }
    : { defaultValue: controlledDefaultValue || Location.LAWRENCEVILLE, onValueChange: handleValueChange };

  return (
    <Tabs
      {...tabsProps}
      orientation={orientation}
      className={cn("w-full", className)}
      suppressHydrationWarning
    >
      <TabsList className={cn(
        "grid w-fit mx-auto",
        orientation === 'horizontal' ? "grid-cols-2" : "grid-rows-2 h-auto flex-col"
      )}>
        {ALL_LOCATIONS.map((location) => (
          <TabsTrigger
            key={location}
            value={location}
            className={cn(
              "text-sm font-medium",
              orientation === 'vertical' && "justify-start"
            )}
          >
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