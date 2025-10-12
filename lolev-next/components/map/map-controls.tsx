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
  showSearch = true
}: MapControlsProps) {
  return (
    <Card className="rounded-b-none border-0 border-b p-4 flex-shrink-0 shadow-none">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onNearMeClick}
              className="h-8 bg-secondary"
            >
              <Locate className="h-4 w-4 mr-1" />
              Near Me
            </Button>
            <span className="text-sm text-muted-foreground">
              {locationCount} locations
            </span>
          </div>
          {/* Mobile view toggle */}
          <div className="flex md:hidden gap-1">
            <Button
              variant={mobileView === 'map' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onMobileViewChange('map')}
              className="h-8 px-3"
            >
              <MapIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={mobileView === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onMobileViewChange('list')}
              className="h-8 px-3"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showSearch && (
          <div className="relative">
            {isSearching ? (
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            )}
            <Input
              placeholder="Search by name, zipcode, or address..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 h-8 bg-secondary"
            />
            {hasSearchLocation && (
              <Badge variant="secondary" className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] py-0">
                <MapPin className="h-2 w-2 mr-1" />
                Location
              </Badge>
            )}
          </div>
        )}

        {nearbyLocations.length > 0 && (
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
        )}
      </div>
    </Card>
  );
}
