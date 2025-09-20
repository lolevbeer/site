'use client';

/**
 * Event Calendar Component
 * Displays events in a weekly calendar view with location awareness
 */

import React, { useState, useMemo } from 'react';
import { BreweryEvent, EventType, EventStatus } from '@/lib/types/event';
import { Location, LocationDisplayNames } from '@/lib/types/location';
import { useLocationContext } from '@/components/location/location-provider';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EventCalendarProps {
  events: BreweryEvent[];
  className?: string;
  showLocationFilter?: boolean;
  onEventClick?: (event: BreweryEvent) => void;
  onDateClick?: (date: Date) => void;
  showAddEvent?: boolean;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: BreweryEvent[];
}

/**
 * Weekly calendar view for events
 */
export function EventCalendar({
  events,
  className,
  showLocationFilter = true,
  onEventClick,
  onDateClick,
  showAddEvent = false
}: EventCalendarProps) {
  const { currentLocation } = useLocationContext();
  const [currentWeek, setCurrentWeek] = useState(getStartOfWeek(new Date()));
  const [selectedLocation, setSelectedLocation] = useState<Location | undefined>(
    showLocationFilter ? currentLocation : undefined
  );

  // Get start of week (Sunday)
  function getStartOfWeek(date: Date): Date {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day;
    return new Date(start.setDate(diff));
  }

  // Generate week days
  const weekDays = useMemo(() => {
    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeek);
      date.setDate(currentWeek.getDate() + i);

      const dayEvents = events.filter(event => {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);

        // Filter by location
        if (selectedLocation && event.location !== selectedLocation) {
          return false;
        }

        // Filter by date
        return eventDate.getTime() === date.getTime();
      });

      days.push({
        date,
        isCurrentMonth: date.getMonth() === today.getMonth(),
        isToday: date.getTime() === today.getTime(),
        events: dayEvents
      });
    }

    return days;
  }, [currentWeek, events, selectedLocation]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  const goToToday = () => {
    setCurrentWeek(getStartOfWeek(new Date()));
  };

  const formatTime = (timeString: string) => {
    try {
      if (timeString.includes(':')) {
        const [time, period] = timeString.split(/\s*(AM|PM|am|pm)\s*/);
        if (period) {
          return timeString.toLowerCase();
        }
        // 24-hour format
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'pm' : 'am';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes}${ampm}`;
      }
      return timeString.toLowerCase();
    } catch {
      return timeString;
    }
  };

  const getEventTypeColor = (type: EventType) => {
    const colors = {
      [EventType.TRIVIA]: 'bg-blue-100 text-blue-800 border-blue-200',
      [EventType.LIVE_MUSIC]: 'bg-purple-100 text-purple-800 border-purple-200',
      [EventType.GAME_NIGHT]: 'bg-green-100 text-green-800 border-green-200',
      [EventType.SPECIAL_EVENT]: 'bg-red-100 text-red-800 border-red-200',
      [EventType.MARKET]: 'bg-orange-100 text-orange-800 border-orange-200',
      [EventType.SPORTS]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      [EventType.ENTERTAINMENT]: 'bg-pink-100 text-pink-800 border-pink-200',
      [EventType.PRIVATE_EVENT]: 'bg-gray-100 text-gray-800 border-gray-200',
      [EventType.BREWERY_TOUR]: 'bg-amber-100 text-amber-800 border-amber-200',
      [EventType.TASTING]: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      [EventType.FOOD_PAIRING]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      [EventType.COMMUNITY]: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      [EventType.SEASONAL]: 'bg-violet-100 text-violet-800 border-violet-200',
      [EventType.RECURRING]: 'bg-slate-100 text-slate-800 border-slate-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const weekRange = useMemo(() => {
    const endWeek = new Date(currentWeek);
    endWeek.setDate(currentWeek.getDate() + 6);

    const startMonth = currentWeek.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endWeek.toLocaleDateString('en-US', { month: 'short' });

    if (startMonth === endMonth) {
      return `${startMonth} ${currentWeek.getDate()}-${endWeek.getDate()}, ${currentWeek.getFullYear()}`;
    } else {
      return `${startMonth} ${currentWeek.getDate()} - ${endMonth} ${endWeek.getDate()}, ${currentWeek.getFullYear()}`;
    }
  }, [currentWeek]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">Event Calendar</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="min-w-[100px]"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Location Filter */}
          {showLocationFilter && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Location:</span>
              <div className="flex gap-1">
                <Button
                  variant={!selectedLocation ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedLocation(undefined)}
                >
                  All
                </Button>
                {Object.values(Location).map(location => (
                  <Button
                    key={location}
                    variant={selectedLocation === location ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedLocation(location)}
                  >
                    {LocationDisplayNames[location]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {showAddEvent && (
            <Button size="sm" className="flex items-center gap-1">
              <Plus className="h-3 w-3" />
              Add Event
            </Button>
          )}
        </div>
      </div>

      {/* Week Range */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-muted-foreground">
          {weekRange}
        </h3>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-4">
        {/* Day Headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center font-semibold text-sm text-muted-foreground py-2">
            {day}
          </div>
        ))}

        {/* Calendar Days */}
        {weekDays.map((day, index) => (
          <Card
            key={index}
            className={cn(
              'min-h-[200px] p-3 cursor-pointer transition-all duration-200 hover:shadow-md',
              day.isToday && 'ring-2 ring-blue-500 ring-opacity-50 bg-blue-50',
              !day.isCurrentMonth && 'opacity-50',
              day.events.length === 0 && 'bg-muted/30'
            )}
            onClick={() => onDateClick?.(day.date)}
          >
            <div className="space-y-2">
              {/* Date Header */}
              <div className="flex items-center justify-between">
                <span className={cn(
                  'text-sm font-medium',
                  day.isToday && 'text-blue-600 font-bold'
                )}>
                  {day.date.getDate()}
                </span>
                {day.events.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {day.events.length}
                  </Badge>
                )}
              </div>

              {/* Events */}
              <div className="space-y-1">
                {day.events.slice(0, 3).map((event, eventIndex) => (
                  <div
                    key={eventIndex}
                    className={cn(
                      'text-xs p-2 rounded border cursor-pointer transition-colors hover:opacity-80',
                      getEventTypeColor(event.type),
                      event.status === EventStatus.CANCELLED && 'opacity-50 line-through'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(event);
                    }}
                  >
                    <div className="font-medium truncate">
                      {event.title}
                    </div>
                    <div className="flex items-center gap-1 text-xs opacity-75">
                      <Clock className="h-2 w-2" />
                      {formatTime(event.time)}
                      {showLocationFilter && (
                        <>
                          <MapPin className="h-2 w-2 ml-1" />
                          <span className="truncate">
                            {LocationDisplayNames[event.location]}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {/* Show more indicator */}
                {day.events.length > 3 && (
                  <div className="text-xs text-muted-foreground text-center py-1">
                    +{day.events.length - 3} more
                  </div>
                )}

                {/* Empty state for days with no events */}
                {day.events.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-4 opacity-50">
                    No events
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center flex-wrap gap-2 pt-4 border-t">
        <span className="text-sm font-medium text-muted-foreground">Event Types:</span>
        {Object.values(EventType).slice(0, 6).map(type => (
          <div key={type} className="flex items-center gap-1">
            <div className={cn('w-3 h-3 rounded', getEventTypeColor(type).split(' ')[0])} />
            <span className="text-xs">
              {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>
        ))}
        <span className="text-xs text-muted-foreground">+{Object.values(EventType).length - 6} more</span>
      </div>
    </div>
  );
}

/**
 * Compact calendar component for smaller spaces
 */
export function CompactEventCalendar({
  events,
  className,
  onEventClick
}: {
  events: BreweryEvent[];
  className?: string;
  onEventClick?: (event: BreweryEvent) => void;
}) {
  return (
    <EventCalendar
      events={events}
      className={cn('max-w-4xl', className)}
      showLocationFilter={false}
      onEventClick={onEventClick}
      showAddEvent={false}
    />
  );
}

export default EventCalendar;