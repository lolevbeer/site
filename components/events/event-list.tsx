'use client';

/**
 * Event List Component
 * Displays a list of events with filtering, sorting, and location awareness
 */

import React, { useState, useMemo } from 'react';
import { BreweryEvent, EventType, EventStatus, EventFilters, EventSortOptions } from '@/lib/types/event';
import type { LocationSlug } from '@/lib/types/location';
import { useLocationContext } from '@/components/location/location-provider';
import { EventCard } from './event-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatTime, parseLocalDate, isToday, isFuture } from '@/lib/utils/formatters';

interface EventListProps {
  events: BreweryEvent[];
  loading?: boolean;
  className?: string;
  showLocationFilter?: boolean;
  showFilters?: boolean;
  variant?: 'default' | 'compact' | 'featured';
  initialFilters?: Partial<EventFilters>;
  onEventClick?: (event: BreweryEvent) => void;
  emptyMessage?: string;
  maxItems?: number;
  selectedLocation?: LocationSlug | 'all';
  onLocationChange?: (location: LocationSlug | 'all') => void;
}

/**
 * Event list component with filtering and sorting
 */
export function EventList({
  events,
  loading = false,
  className,
  showLocationFilter = true,
  showFilters = true,
  variant = 'default',
  initialFilters = {},
  // onEventClick parameter is accepted but not used in current implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onEventClick,
  emptyMessage = 'No events found',
  maxItems,
  selectedLocation: parentSelectedLocation,
  onLocationChange
}: EventListProps) {
  const { currentLocation, locations } = useLocationContext();
  const [searchQuery, setSearchQuery] = useState(initialFilters.search || '');
  const [selectedTypes, setSelectedTypes] = useState<EventType[]>(initialFilters.type || []);
  const [internalSelectedLocation, setInternalSelectedLocation] = useState<LocationSlug | undefined>(
    showLocationFilter ? initialFilters.location || currentLocation : currentLocation
  );

  // Helper to get location name
  const getLocationName = (slug: LocationSlug): string => {
    const location = locations.find(loc => (loc.slug || loc.id) === slug);
    return location?.name || slug;
  };

  // Use parent location if provided, otherwise use internal state
  const selectedLocation = parentSelectedLocation !== undefined ?
    (parentSelectedLocation === 'all' ? undefined : parentSelectedLocation) :
    internalSelectedLocation;
  const [sortOptions, setSortOptions] = useState<EventSortOptions>({
    sortBy: 'date',
    order: 'asc'
  });
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  // Filter and sort events
  const filteredAndSortedEvents = useMemo(() => {
    let filtered = events.filter(event => {
      // Location filter
      if (selectedLocation && event.location !== selectedLocation) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !event.title.toLowerCase().includes(query) &&
          !event.description?.toLowerCase().includes(query) &&
          !event.vendor.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Type filter
      if (selectedTypes.length > 0 && !selectedTypes.includes(event.type)) {
        return false;
      }

      // Status filter (hide cancelled by default)
      if (event.status === EventStatus.CANCELLED) {
        return false;
      }

      return true;
    });

    // Sort events
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortOptions.sortBy) {
        case 'date':
          comparison = parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'attendees':
          comparison = (a.attendees || 0) - (b.attendees || 0);
          break;
      }

      return sortOptions.order === 'desc' ? -comparison : comparison;
    });

    // Apply max items limit
    if (maxItems) {
      filtered = filtered.slice(0, maxItems);
    }

    return filtered;
  }, [events, selectedLocation, searchQuery, selectedTypes, sortOptions, maxItems]);

  // Get upcoming events (tomorrow onwards)
  const upcomingEvents = useMemo(() =>
    filteredAndSortedEvents.filter(event => isFuture(event.date)),
    [filteredAndSortedEvents]
  );

  // Get today's events
  const todaysEvents = useMemo(() =>
    filteredAndSortedEvents.filter(event => isToday(event.date)),
    [filteredAndSortedEvents]
  );

  const hasActiveFilters = searchQuery || selectedTypes.length > 0 ||
    (showLocationFilter && selectedLocation !== currentLocation);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTypes([]);
    if (parentSelectedLocation !== undefined && onLocationChange) {
      onLocationChange('all');
    } else {
      setInternalSelectedLocation(showLocationFilter ? currentLocation : undefined);
    }
  };

  const toggleEventType = (type: EventType) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const toggleSort = (sortBy: EventSortOptions['sortBy']) => {
    setSortOptions(prev => ({
      sortBy,
      order: prev.sortBy === sortBy && prev.order === 'asc' ? 'desc' : 'asc'
    }));
  };

  const renderEvents = (eventsToRender: BreweryEvent[], layoutType: 'list' | 'grid' | 'adaptive-grid' = 'list') => {
    if (loading) {
      return (
        <div className={layoutType !== 'list' ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "space-y-4"}>
          {Array.from({ length: layoutType !== 'list' ? 4 : 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border shadow-sm animate-pulse h-64" />
          ))}
        </div>
      );
    }

    if (eventsToRender.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📅</div>
          <h3 className="text-lg font-semibold mb-2">No Events Found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? `No events matching "${searchQuery}"`
              : selectedTypes.length > 0
              ? `No ${selectedTypes.join(' or ')} events found`
              : emptyMessage}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      );
    }

    if (layoutType === 'adaptive-grid') {
      // Adaptive grid for Today's events - adjusts columns based on count
      const gridCols = eventsToRender.length === 1 ? 'md:grid-cols-1' :
                       eventsToRender.length === 2 ? 'md:grid-cols-2' :
                       eventsToRender.length === 3 ? 'md:grid-cols-3' :
                       'md:grid-cols-2 lg:grid-cols-4';

      return (
        <div className={cn('grid gap-4 grid-cols-1', gridCols)}>
          {eventsToRender.map(event => (
            <EventCard
              key={event.id || `${event.title}-${event.date}`}
              event={event}
              currentLocation={event.location}
            />
          ))}
        </div>
      );
    }

    if (layoutType === 'grid') {
      // Adaptive grid for Upcoming events - full width for fewer than 6 items
      return (
        <div className={cn(
          "grid gap-4",
          eventsToRender.length < 6
            ? "grid-cols-1"
            : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        )}>
          {eventsToRender.map(event => (
            <EventCard
              key={event.id || `${event.title}-${event.date}`}
              event={event}
              currentLocation={event.location}
            />
          ))}
        </div>
      );
    }

    return (
      <div className={cn(
        'space-y-4',
        variant === 'compact' && 'space-y-2'
      )}>
        {eventsToRender.map(event => (
          <EventCard
            key={event.id || `${event.title}-${event.date}`}
            event={event}
            currentLocation={event.location}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Filters and Search */}
      {showFilters && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className="flex items-center gap-1"
            >
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {[
                    searchQuery ? 1 : 0,
                    selectedTypes.length,
                    showLocationFilter && selectedLocation !== currentLocation ? 1 : 0
                  ].reduce((sum, count) => sum + count, 0)}
                </Badge>
              )}
            </Button>

            {/* Location Filter and Sort Options on the right */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Sort Button */}
              <Button
                variant={sortOptions.sortBy === 'date' ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleSort('date')}
                className="flex items-center gap-1"
              >
                Date
                {sortOptions.sortBy === 'date' && (
                  sortOptions.order === 'asc' ? ' ↑' : ' ↓'
                )}
              </Button>

              {/* Location Filter */}
              {parentSelectedLocation !== undefined && onLocationChange && (
                <Tabs
                  value={parentSelectedLocation}
                  onValueChange={(value) => onLocationChange(value as LocationSlug | 'all')}
                  className="w-auto"
                >
                  <TabsList className={cn("grid w-fit", `grid-cols-${locations.length + 1}`)}>
                    <TabsTrigger value="all">All</TabsTrigger>
                    {locations.map(location => {
                      const slug = location.slug || location.id;
                      return (
                        <TabsTrigger key={slug} value={slug}>
                          {location.name}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </Tabs>
              )}
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="flex items-center gap-1 text-muted-foreground"
              >
                Clear
              </Button>
            )}
          </div>

          {/* Extended Filters Panel */}
          {showFiltersPanel && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              {/* Event Type Filter */}
              <div>
                <div className="text-sm font-medium mb-2" id="event-types-label">Event Types</div>
                <div className="flex gap-2 flex-wrap" role="group" aria-labelledby="event-types-label">
                  {Object.values(EventType).map(type => (
                    <Button
                      key={type}
                      variant={selectedTypes.includes(type) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleEventType(type)}
                      aria-pressed={selectedTypes.includes(type)}
                    >
                      {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Today's Events Section */}
      {todaysEvents.length > 0 && !maxItems && (
        <Card className="shadow-none border-2 border-black">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-center">Today&apos;s Event{todaysEvents.length !== 1 ? 's' : ''}</h2>
            <div className="flex flex-col gap-3">
              {todaysEvents.map(event => (
                <div key={event.id || `${event.title}-${event.date}`} className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-semibold">{event.title}</span>
                    {event.time && (
                      <span className="text-sm text-muted-foreground">@ {formatTime(event.time.split('-')[0].trim())}</span>
                    )}
                  </div>
                  {showLocationFilter && (
                    <div className="text-sm text-muted-foreground">
                      {getLocationName(event.location)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Events List */}
      <div>
        {renderEvents(maxItems ? filteredAndSortedEvents : upcomingEvents, 'grid')}
      </div>

      {/* Load More Button */}
      {maxItems && filteredAndSortedEvents.length > maxItems && (
        <div className="text-center">
          <Button variant="outline">
            View All Events ({filteredAndSortedEvents.length - maxItems} more)
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Simplified event list for quick display
 */
export function SimpleEventList({
  events,
  loading = false,
  className,
  maxItems = 5
}: {
  events: BreweryEvent[];
  loading?: boolean;
  className?: string;
  maxItems?: number;
}) {
  return (
    <EventList
      events={events}
      loading={loading}
      className={className}
      showLocationFilter={false}
      showFilters={false}
      variant="compact"
      maxItems={maxItems}
      emptyMessage="No upcoming events"
    />
  );
}

export default EventList;
