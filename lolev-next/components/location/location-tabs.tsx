/**
 * Location Tabs Component
 * Tab component for location-based content using shadcn/ui Tabs
 */

'use client';

import React, { ReactNode } from 'react';
import { MapPin, Clock, CheckCircle, Users, Car, Wifi } from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Location, LocationDisplayNames, LocationFeature } from '@/lib/types/location';
import { useLocationContext } from './location-provider';
import { ALL_LOCATIONS, getLocationInfo, isLocationOpen } from '@/lib/config/locations';

interface LocationTabsProps {
  /** Custom className for styling */
  className?: string;
  /** Default tab value (location) */
  defaultValue?: Location;
  /** Controlled value */
  value?: Location;
  /** Value change handler */
  onValueChange?: (location: Location) => void;
  /** Content for each location */
  children: ReactNode;
  /** Show status indicators */
  showStatus?: boolean;
  /** Orientation of tabs */
  orientation?: 'horizontal' | 'vertical';
  /** Sync with global location state */
  syncWithGlobalState?: boolean;
}

/**
 * Location Tabs Component
 */
export function LocationTabs({
  className,
  defaultValue,
  value,
  onValueChange,
  children,
  showStatus = true,
  orientation = 'horizontal',
  syncWithGlobalState = false
}: LocationTabsProps) {
  const {
    currentLocation,
    setLocation,
    isClient
  } = useLocationContext();

  // Use global state if syncWithGlobalState is true
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

  if (!isClient) {
    return (
      <div className={cn("w-full", className)}>
        <div className="h-10 w-full rounded-md border bg-background animate-pulse" />
      </div>
    );
  }

  return (
    <Tabs
      value={controlledValue}
      defaultValue={controlledDefaultValue || Location.LAWRENCEVILLE}
      onValueChange={handleValueChange}
      orientation={orientation}
      className={cn("w-full", className)}
    >
      <TabsList className={cn(
        "grid w-full",
        orientation === 'horizontal' ? "grid-cols-2" : "grid-rows-2 h-auto flex-col"
      )}>
        {ALL_LOCATIONS.map((location) => {
          const locationInfo = getLocationInfo(location);
          const locationIsOpen = isLocationOpen(location);

          return (
            <TabsTrigger
              key={location}
              value={location}
              className={cn(
                "flex items-center gap-2 text-sm font-medium",
                orientation === 'vertical' && "justify-start"
              )}
            >
              <MapPin className="h-4 w-4" />
              <span>{LocationDisplayNames[location]}</span>
              {showStatus && (
                <Badge
                  variant={locationIsOpen ? "default" : "secondary"}
                  className={cn(
                    "ml-auto text-xs",
                    locationIsOpen && "bg-green-100 text-green-800 border-green-200"
                  )}
                >
                  {locationIsOpen ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                </Badge>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {children}
    </Tabs>
  );
}

/**
 * Location Tab Content wrapper
 */
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

/**
 * Auto-generated Location Tab Content with location info
 */
interface AutoLocationTabContentProps {
  location: Location;
  className?: string;
  showFeatures?: boolean;
  showHours?: boolean;
  showContact?: boolean;
  customContent?: ReactNode;
}

export function AutoLocationTabContent({
  location,
  className,
  showFeatures = true,
  showHours = true,
  showContact = true,
  customContent
}: AutoLocationTabContentProps) {
  const { hours } = useLocationContext();
  const locationInfo = getLocationInfo(location);
  const locationIsOpen = isLocationOpen(location);

  return (
    <LocationTabContent location={location} className={className}>
      <div className="space-y-6">
        {/* Location Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {LocationDisplayNames[location]}
            </h3>
            <p className="text-muted-foreground">
              {locationInfo.address}, {locationInfo.city}, {locationInfo.state} {locationInfo.zipCode}
            </p>
          </div>
          <Badge
            variant={locationIsOpen ? "default" : "secondary"}
            className={cn(
              locationIsOpen && "bg-green-100 text-green-800 border-green-200"
            )}
          >
            {locationIsOpen ? (
              <>
                <CheckCircle className="mr-1 h-3 w-3" />
                Open Now
              </>
            ) : (
              <>
                <Clock className="mr-1 h-3 w-3" />
                Closed
              </>
            )}
          </Badge>
        </div>

        {/* Custom Content */}
        {customContent && (
          <div>{customContent}</div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Hours */}
          {showHours && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4" />
                  Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {hours.getAllHours().map((day) => (
                    <div
                      key={day.day}
                      className={cn(
                        "flex justify-between text-sm",
                        day.isToday && "font-medium text-primary"
                      )}
                    >
                      <span>{day.day}</span>
                      <span>{day.hours}</span>
                    </div>
                  ))}
                  {locationInfo.hours.notes && (
                    <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                      {locationInfo.hours.notes}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contact & Info */}
          {showContact && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4" />
                  Contact & Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {locationInfo.phone && (
                  <div className="text-sm">
                    <span className="font-medium">Phone:</span>
                    <br />
                    <a
                      href={`tel:${locationInfo.phone}`}
                      className="text-primary hover:underline"
                    >
                      {locationInfo.phone}
                    </a>
                  </div>
                )}
                {locationInfo.email && (
                  <div className="text-sm">
                    <span className="font-medium">Email:</span>
                    <br />
                    <a
                      href={`mailto:${locationInfo.email}`}
                      className="text-primary hover:underline"
                    >
                      {locationInfo.email}
                    </a>
                  </div>
                )}
                {locationInfo.parking && (
                  <div className="text-sm">
                    <span className="font-medium flex items-center gap-1">
                      <Car className="h-3 w-3" />
                      Parking:
                    </span>
                    <p className="text-muted-foreground text-xs mt-1">
                      {locationInfo.parking}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Features */}
        {showFeatures && locationInfo.features && locationInfo.features.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Amenities & Features
              </CardTitle>
              <CardDescription>
                What&apos;s available at this location
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {locationInfo.features.map((feature) => {
                  const getFeatureIcon = (feature: LocationFeature) => {
                    switch (feature) {
                      case LocationFeature.WIFI:
                        return <Wifi className="h-3 w-3" />;
                      case LocationFeature.PET_FRIENDLY:
                        return <span className="text-xs">🐕</span>;
                      case LocationFeature.FAMILY_FRIENDLY:
                        return <Users className="h-3 w-3" />;
                      case LocationFeature.OUTDOOR_SEATING:
                        return <span className="text-xs">🌿</span>;
                      case LocationFeature.LIVE_MUSIC:
                        return <span className="text-xs">🎵</span>;
                      case LocationFeature.FOOD_TRUCKS:
                        return <span className="text-xs">🚚</span>;
                      default:
                        return null;
                    }
                  };

                  const featureDisplayNames: Record<LocationFeature, string> = {
                    [LocationFeature.OUTDOOR_SEATING]: 'Outdoor Seating',
                    [LocationFeature.PET_FRIENDLY]: 'Pet Friendly',
                    [LocationFeature.FAMILY_FRIENDLY]: 'Family Friendly',
                    [LocationFeature.LIVE_MUSIC]: 'Live Music',
                    [LocationFeature.FOOD_TRUCKS]: 'Food Trucks',
                    [LocationFeature.PRIVATE_EVENTS]: 'Private Events',
                    [LocationFeature.TOURS]: 'Brewery Tours',
                    [LocationFeature.MERCHANDISE]: 'Merchandise',
                    [LocationFeature.GROWLERS]: 'Growler Fills',
                    [LocationFeature.DELIVERY]: 'Delivery',
                    [LocationFeature.TAKEOUT]: 'Takeout',
                    [LocationFeature.WIFI]: 'Free WiFi',
                    [LocationFeature.ACCESSIBILITY]: 'Wheelchair Accessible',
                  };

                  return (
                    <Badge key={feature} variant="secondary" className="text-xs">
                      {getFeatureIcon(feature)}
                      <span className="ml-1">
                        {featureDisplayNames[feature]}
                      </span>
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </LocationTabContent>
  );
}

/**
 * Complete Location Tabs with auto-generated content
 */
interface CompleteLocationTabsProps {
  className?: string;
  showStatus?: boolean;
  showFeatures?: boolean;
  showHours?: boolean;
  showContact?: boolean;
  syncWithGlobalState?: boolean;
  customContent?: Record<Location, ReactNode>;
}

export function CompleteLocationTabs({
  className,
  showStatus = true,
  showFeatures = true,
  showHours = true,
  showContact = true,
  syncWithGlobalState = true,
  customContent
}: CompleteLocationTabsProps) {
  return (
    <LocationTabs
      className={className}
      showStatus={showStatus}
      syncWithGlobalState={syncWithGlobalState}
    >
      {ALL_LOCATIONS.map((location) => (
        <AutoLocationTabContent
          key={location}
          location={location}
          showFeatures={showFeatures}
          showHours={showHours}
          showContact={showContact}
          customContent={customContent?.[location]}
        />
      ))}
    </LocationTabs>
  );
}