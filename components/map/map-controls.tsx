import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MapPin, Search, Locate, Map as MapIcon, List } from 'lucide-react';

interface NearbyLocation {
  uniqueId: string;
  name: string;
  distance?: number;
}

interface MapControlsProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  isSearching: boolean;
  hasSearchLocation: boolean;
  locationCount: number;
  nearbyLocations: NearbyLocation[];
  onNearMeClick: () => void;
  onNearbyLocationClick: (location: NearbyLocation) => void;
  mobileView: 'map' | 'list';
  onMobileViewChange: (view: 'map' | 'list') => void;
  showSearch?: boolean;
  distanceFromLabel?: string | null;
}

const capitalizeName = (name: string) => {
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export function MapControls({
  searchTerm,
  onSearchChange,
  isSearching,
  hasSearchLocation,
  locationCount,
  nearbyLocations,
  onNearMeClick,
  onNearbyLocationClick,
  mobileView,
  onMobileViewChange,
  showSearch = true,
  distanceFromLabel
}: MapControlsProps) {
  return (
    <Card className="border-0 flex-shrink-0 shadow-none pb-4 bg-transparent overflow-visible">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          {/* Search + Near Me integrated */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {showSearch && (
              <div className="relative group flex-1 max-w-sm p-1">
                {isSearching ? (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-10">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-all duration-200 z-10 ${searchTerm ? 'search-active text-primary' : 'group-focus-within:text-foreground'}`} />
                )}
                <Input
                  placeholder="Search location..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-9 h-8 bg-secondary border-0 transition-all duration-200 focus:bg-background focus:shadow-sm focus:ring-1 focus:ring-primary/20"
                />
                {hasSearchLocation && (
                  <Badge variant="secondary" className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] py-0">
                    <MapPin className="h-2 w-2 mr-1" />
                    Location
                  </Badge>
                )}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onNearMeClick}
              className="h-8 bg-secondary shrink-0"
            >
              <Locate className="h-4 w-4 mr-1" />
              Near Me
            </Button>
            <span className="text-sm text-muted-foreground whitespace-nowrap hidden sm:inline">
              {locationCount} locations
            </span>
          </div>
          {/* Mobile view toggle - segmented control */}
          <div className="flex md:hidden p-1 bg-secondary rounded-lg shrink-0">
            <button
              onClick={() => onMobileViewChange('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                mobileView === 'map'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MapIcon className="h-4 w-4" />
              <span>Map</span>
            </button>
            <button
              onClick={() => onMobileViewChange('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                mobileView === 'list'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="h-4 w-4" />
              <span>List</span>
            </button>
          </div>
        </div>

        {nearbyLocations.length > 0 && (
          <div className="flex flex-col gap-2">
            {distanceFromLabel && (
              <span className="text-xs text-muted-foreground">
                Distances from <span className="font-medium text-foreground">{distanceFromLabel}</span>
              </span>
            )}
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                <MapPin className="h-3 w-3 inline mr-1" />
                Nearest:
              </span>
              {nearbyLocations.map((location) => (
                <Badge
                  key={location.uniqueId}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs whitespace-nowrap"
                  onClick={() => onNearbyLocationClick(location)}
                >
                  {capitalizeName(location.name).substring(0, 25)}
                  {location.distance !== undefined && <span className="ml-1 opacity-75">({location.distance.toFixed(1)}mi)</span>}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
