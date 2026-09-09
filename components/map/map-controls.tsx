'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { MapPin, Map as MapIcon, List } from '@/components/icons'
import { capitalizeName } from '@/lib/utils/formatters'
import { MapSearchField } from '@/components/map/map-search-field'
import type { PlaceSuggestion } from '@/lib/map/search'

interface NearbyLocation {
  uniqueId: string
  name: string
  distance?: number
}

interface MapControlsProps {
  searchTerm: string
  onSearchChange: (term: string) => void
  isSearching: boolean
  suggestions: PlaceSuggestion[]
  onSelectSuggestion: (suggestion: PlaceSuggestion) => void
  onCommitSearch: () => void
  locationCount: number
  locationTotal: number
  nearbyLocations: NearbyLocation[]
  onNearMeClick: () => void
  onNearbyLocationClick: (location: NearbyLocation) => void
  mobileView: 'map' | 'list'
  onMobileViewChange: (view: 'map' | 'list') => void
  showSearch?: boolean
  distanceFromLabel?: string | null
}

export function MapControls({
  searchTerm,
  onSearchChange,
  isSearching,
  suggestions,
  onSelectSuggestion,
  onCommitSearch,
  locationCount,
  locationTotal,
  nearbyLocations,
  onNearMeClick,
  onNearbyLocationClick,
  mobileView,
  onMobileViewChange,
  showSearch = true,
  distanceFromLabel,
}: MapControlsProps) {
  const countLabel =
    locationTotal > locationCount
      ? `${locationCount} of ${locationTotal} locations`
      : `${locationTotal} locations`

  return (
    <div className="flex-shrink-0 p-1 pb-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {showSearch && (
            <MapSearchField
              className="w-full md:w-auto md:flex-1 md:max-w-sm order-1"
              value={searchTerm}
              onValueChange={onSearchChange}
              isSearching={isSearching}
              suggestions={suggestions}
              onSelect={onSelectSuggestion}
              onCommit={onCommitSearch}
              inputClassName="h-10 md:h-8"
            />
          )}
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onNearMeClick}
            className="h-8 min-h-6 order-2 shrink-0"
          >
            Near Me
          </Button>
          <span className="text-sm text-muted-foreground whitespace-nowrap hidden sm:inline order-3">
            {countLabel}
          </span>
          <div
            role="group"
            aria-label="Map or list"
            className="flex md:hidden p-1 bg-secondary rounded-lg shrink-0 order-4 ml-auto"
          >
            <button
              type="button"
              aria-pressed={mobileView === 'map'}
              onClick={() => onMobileViewChange('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 min-h-6 text-sm font-medium rounded-md transition-all duration-200 ${
                mobileView === 'map'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MapIcon className="h-4 w-4" />
              <span>Map</span>
            </button>
            <button
              type="button"
              aria-pressed={mobileView === 'list'}
              onClick={() => onMobileViewChange('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 min-h-6 text-sm font-medium rounded-md transition-all duration-200 ${
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
                <Button
                  key={location.uniqueId}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 min-h-6 text-xs whitespace-nowrap"
                  onClick={() => onNearbyLocationClick(location)}
                >
                  {capitalizeName(location.name).substring(0, 25)}
                  {location.distance !== undefined && (
                    <span className="ml-1 opacity-75">({location.distance.toFixed(1)}mi)</span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
