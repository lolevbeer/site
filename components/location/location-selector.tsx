/**
 * Location Selector Component
 * Dropdown component for selecting brewery location using shadcn/ui Select
 */

'use client';

import React from 'react';
import { MapPin, Clock, CheckCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LocationSlug } from '@/lib/types/location';
import { useLocationContext } from './location-provider';
import { trackLocationSwitch } from '@/lib/analytics/events';

interface LocationSelectorProps {
  /** Custom className for styling */
  className?: string;
  /** Show status badge (open/closed) */
  showStatus?: boolean;
  /** Show address in dropdown */
  showAddress?: boolean;
  /** Compact mode - smaller size */
  compact?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Custom trigger content */
  renderTrigger?: (currentLocation: LocationSlug, isOpen: boolean) => React.ReactNode;
}

/**
 * Location Selector Dropdown Component
 */
export function LocationSelector({
  className,
  showStatus = true,
  showAddress = true,
  compact = false,
  disabled = false,
  placeholder = "Select location...",
  renderTrigger
}: LocationSelectorProps) {
  const {
    currentLocation,
    currentLocationData,
    locations,
    setLocation,
    isClient,
    isOpen
  } = useLocationContext();

  // Handle location change
  const handleLocationChange = (value: string) => {
    const slug = value as LocationSlug;
    trackLocationSwitch(currentLocation, slug);
    setLocation(slug);
  };

  // Don't render until client-side hydration is complete
  if (!isClient) {
    return (
      <div className={cn("h-10 w-full rounded-md border bg-background", className)}>
        <div className="flex h-full items-center px-3 text-sm text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <Select
      value={currentLocation}
      onValueChange={handleLocationChange}
      disabled={disabled}
    >
      <SelectTrigger className={cn(
        "w-full",
        compact && "h-8 text-sm",
        className
      )}>
        {renderTrigger ? (
          renderTrigger(currentLocation, isOpen)
        ) : (
          <SelectValue placeholder={placeholder}>
            <div className="flex items-center gap-2">
              <MapPin className={cn(
                "text-muted-foreground",
                compact ? "h-3 w-3" : "h-4 w-4"
              )} />
              <span className="font-medium">
                {currentLocationData?.name || currentLocation}
              </span>
              {showStatus && (
                <Badge
                  variant={isOpen ? "default" : "secondary"}
                  className={cn(
                    "ml-auto",
                    compact && "text-xs px-1.5 py-0.5",
                    isOpen && "bg-green-100 text-green-800 border-green-200"
                  )}
                >
                  {isOpen ? (
                    <>
                      <CheckCircle className={cn(
                        "mr-1",
                        compact ? "h-2 w-2" : "h-3 w-3"
                      )} />
                      Open
                    </>
                  ) : (
                    <>
                      <Clock className={cn(
                        "mr-1",
                        compact ? "h-2 w-2" : "h-3 w-3"
                      )} />
                      Closed
                    </>
                  )}
                </Badge>
              )}
            </div>
          </SelectValue>
        )}
      </SelectTrigger>
      <SelectContent>
        {locations.filter(loc => loc.active).map((location) => {
          const locationSlug = (location.slug || location.id) as LocationSlug;
          const locationIsOpen = isOpen; // This would be calculated per location in a real app

          return (
            <SelectItem
              key={location.id}
              value={locationSlug}
              className="cursor-pointer"
            >
              <div className="flex w-full items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium">
                      {location.name}
                    </span>
                    {showStatus && (
                      <Badge
                        variant={locationIsOpen ? "default" : "secondary"}
                        className={cn(
                          "text-xs",
                          locationIsOpen && "bg-green-100 text-green-800 border-green-200"
                        )}
                      >
                        {locationIsOpen ? "Open" : "Closed"}
                      </Badge>
                    )}
                  </div>
                  {showAddress && location.address && (
                    <div className="mt-1 text-sm text-muted-foreground pl-6">
                      {location.address.street && location.address.city && (
                        `${location.address.street}, ${location.address.city}`
                      )}
                    </div>
                  )}
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/**
 * Compact Location Selector for navigation bars
 */
export function CompactLocationSelector({ className, ...props }: LocationSelectorProps) {
  return (
    <LocationSelector
      className={cn("w-auto min-w-[160px]", className)}
      compact
      showAddress={false}
      {...props}
    />
  );
}

/**
 * Location Toggle Button - switches between the two locations
 */
interface LocationToggleProps {
  className?: string;
  showLabel?: boolean;
  variant?: "default" | "outline" | "ghost";
}

export function LocationToggle({
  className,
  showLabel = true,
  variant = "outline"
}: LocationToggleProps) {
  const { currentLocation, locations, cycleLocation, isClient } = useLocationContext();

  if (!isClient) {
    return (
      <div className={cn("h-10 w-auto rounded-md border bg-background px-3", className)}>
        <div className="flex h-full items-center text-sm text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  // Find the next location in the cycle
  const activeLocations = locations.filter(loc => loc.active);
  const currentIndex = activeLocations.findIndex(loc => (loc.slug || loc.id) === currentLocation);
  const nextIndex = (currentIndex + 1) % activeLocations.length;
  const nextLocation = activeLocations[nextIndex];
  const nextLocationSlug = (nextLocation?.slug || nextLocation?.id) as LocationSlug;

  const handleToggle = () => {
    if (nextLocationSlug) {
      trackLocationSwitch(currentLocation, nextLocationSlug);
      cycleLocation();
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "default" && "bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2",
        variant === "outline" && "border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2",
        variant === "ghost" && "hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2",
        className
      )}
    >
      <MapPin className="h-4 w-4" />
      {showLabel && nextLocation && (
        <span>
          Switch to {nextLocation.name}
        </span>
      )}
    </button>
  );
}

/**
 * Location Status Badge - shows current location and open/closed status
 */
interface LocationStatusProps {
  className?: string;
  showLocation?: boolean;
  showHours?: boolean;
}

export function LocationStatus({
  className,
  showLocation = true,
  showHours = false
}: LocationStatusProps) {
  const {
    currentLocation,
    currentLocationData,
    isOpen,
    todaysHours,
    nextOpening,
    isClient
  } = useLocationContext();

  if (!isClient) {
    return (
      <Badge variant="secondary" className={className}>
        Loading...
      </Badge>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showLocation && (
        <Badge variant="outline" className="font-medium">
          <MapPin className="mr-1 h-3 w-3" />
          {currentLocationData?.name || currentLocation}
        </Badge>
      )}
      <Badge
        variant={isOpen ? "default" : "secondary"}
        className={cn(
          isOpen && "bg-green-100 text-green-800 border-green-200"
        )}
      >
        {isOpen ? (
          <>
            <CheckCircle className="mr-1 h-3 w-3" />
            Open
          </>
        ) : (
          <>
            <Clock className="mr-1 h-3 w-3" />
            Closed
          </>
        )}
      </Badge>
      {showHours && (
        <Badge variant="outline" className="text-xs">
          {isOpen ? `Until ${todaysHours.split(' - ')[1]}` : nextOpening && `Opens ${nextOpening.day}`}
        </Badge>
      )}
    </div>
  );
}