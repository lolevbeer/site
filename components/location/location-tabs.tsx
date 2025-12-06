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
import type { LocationSlug, PayloadLocation } from '@/lib/types/location';
import { toLocationInfo } from '@/lib/types/location';
import { useLocationContext } from './location-provider';
import { isLocationOpenNow } from '@/lib/config/locations';
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
  const { currentLocation, setLocation, isClient, locations } = useLocationContext();

  const handleValueChange = (newValue: string) => {
    if (syncWithGlobalState) {
      setLocation(newValue);
    }
  };

  // Prevent hydration mismatch by not rendering until client-side
  if (!isClient) {
    return (
      <div className={cn("w-full", className)}>
        <div className="grid w-fit mx-auto grid-cols-2 h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          {locations.map((location) => {
            const slug = location.slug || location.id;
            return (
              <div
                key={slug}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium"
              >
                {location.name}
              </div>
            );
          })}
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
        {locations.map((location) => {
          const slug = location.slug || location.id;
          return (
            <TabsTrigger key={slug} value={slug} className="text-sm font-medium">
              {location.name}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {children}
    </Tabs>
  );
}

interface LocationTabContentProps {
  location: LocationSlug;
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
  location: PayloadLocation;
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
  const locationInfo = toLocationInfo(location);
  const locationIsOpen = isLocationOpenNow(location);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              {location.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {locationInfo.address && locationInfo.city && locationInfo.state && locationInfo.zipCode && (
                `${locationInfo.address}, ${locationInfo.city}, ${locationInfo.state} ${locationInfo.zipCode}`
              )}
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
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}