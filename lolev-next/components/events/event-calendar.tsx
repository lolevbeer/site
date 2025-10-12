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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EventCalendarProps {
  events: BreweryEvent[];
  className?: string;
  showLocationFilter?: boolean;
  onEventClick?: (event: BreweryEvent) => void;
  onDateClick?: (date: Date) => void;
  showAddEvent?: boolean;
  selectedLocation?: Location | 'all';
  onLocationChange?: (location: Location | 'all') => void;
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
  showAddEvent = false,
  selectedLocation: parentSelectedLocation,
  onLocationChange
}: EventCalendarProps) {
  const { currentLocation } = useLocationContext();
  const [currentWeek, setCurrentWeek] = useState(getStartOfWeek(new Date()));
  const [localSelectedLocation, setLocalSelectedLocation] = useState<Location | undefined>(undefined);

  // Use parent location state if provided, otherwise use local state
  const selectedLocation = parentSelectedLocation !== undefined ? parentSelectedLocation : localSelectedLocation;

  // Get start of week (Sunday)
  function getStartOfWeek(date: Date): Date {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day;
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  // Generate week days
  const weekDays = useMemo(() => {
    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeek);
      date.setDate(currentWeek.getDate() + i);
      date.setHours(0, 0, 0, 0);

      const dayEvents = events.filter(event => {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);

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
  }, [currentWeek, events]);

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
      [EventType.TRIVIA]: 'bg-blue-100 dark:bg-blue-900/30 text-gray-900 dark:text-gray-100 border-blue-200 dark:border-blue-700',
      [EventType.LIVE_MUSIC]: 'bg-purple-100 dark:bg-purple-900/30 text-gray-900 dark:text-gray-100 border-purple-200 dark:border-purple-700',
      [EventType.GAME_NIGHT]: 'bg-green-100 dark:bg-green-900/30 text-gray-900 dark:text-gray-100 border-green-200 dark:border-green-700',
      [EventType.SPECIAL_EVENT]: 'bg-red-100 dark:bg-red-900/30 text-gray-900 dark:text-gray-100 border-red-200 dark:border-red-700',
      [EventType.SPECIAL]: 'bg-red-100 dark:bg-red-900/30 text-gray-900 dark:text-gray-100 border-red-200 dark:border-red-700',
      [EventType.MARKET]: 'bg-orange-100 dark:bg-orange-900/30 text-gray-900 dark:text-gray-100 border-orange-200 dark:border-orange-700',
      [EventType.SPORTS]: 'bg-yellow-100 dark:bg-yellow-900/30 text-gray-900 dark:text-gray-100 border-yellow-200 dark:border-yellow-700',
      [EventType.ENTERTAINMENT]: 'bg-pink-100 dark:bg-pink-900/30 text-gray-900 dark:text-gray-100 border-pink-200 dark:border-pink-700',
      [EventType.PRIVATE_EVENT]: 'bg-gray-100 dark:bg-gray-900/30 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700',
      [EventType.BREWERY_TOUR]: 'bg-amber-100 dark:bg-amber-900/30 text-gray-900 dark:text-gray-100 border-amber-200 dark:border-amber-700',
      [EventType.TASTING]: 'bg-indigo-100 dark:bg-indigo-900/30 text-gray-900 dark:text-gray-100 border-indigo-200 dark:border-indigo-700',
      [EventType.FOOD_PAIRING]: 'bg-emerald-100 dark:bg-emerald-900/30 text-gray-900 dark:text-gray-100 border-emerald-200 dark:border-emerald-700',
      [EventType.FOOD_TRUCK]: 'bg-emerald-100 dark:bg-emerald-900/30 text-gray-900 dark:text-gray-100 border-emerald-200 dark:border-emerald-700',
      [EventType.COMMUNITY]: 'bg-cyan-100 dark:bg-cyan-900/30 text-gray-900 dark:text-gray-100 border-cyan-200 dark:border-cyan-700',
      [EventType.SEASONAL]: 'bg-violet-100 dark:bg-violet-900/30 text-gray-900 dark:text-gray-100 border-violet-200 dark:border-violet-700',
      [EventType.RECURRING]: 'bg-slate-100 dark:bg-slate-900/30 text-gray-900 dark:text-gray-100 border-slate-200 dark:border-slate-700',
    };
    return colors[type] || 'bg-gray-100 dark:bg-gray-900/30 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700';
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
          {parentSelectedLocation !== undefined && onLocationChange && (
            <Tabs value={parentSelectedLocation} onValueChange={(value) => onLocationChange(value as Location | 'all')}>
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value={Location.LAWRENCEVILLE}>Lawrenceville</TabsTrigger>
                <TabsTrigger value={Location.ZELIENOPLE}>Zelienople</TabsTrigger>
              </TabsList>
            </Tabs>
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
              'min-h-[200px] p-3 cursor-pointer transition-all duration-200 hover:shadow-md border',
              day.isToday && 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/20',
              !day.isCurrentMonth && 'opacity-50',
              day.events.length === 0 && 'bg-gray-50/50 dark:bg-muted/30'
            )}
            onClick={() => onDateClick?.(day.date)}
          >
            <div className="space-y-2">
              {/* Date Header */}
              <div className="flex items-center justify-between">
                <span className={cn(
                  'text-sm font-medium',
                  day.isToday && 'text-blue-600 dark:text-blue-400 font-bold'
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
                      'text-xs p-2 rounded border cursor-pointer transition-all hover:shadow-sm',
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
                    <div className="flex items-center gap-1 text-xs opacity-70 dark:opacity-75">
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
        {Object.values(EventType).slice(0, 6).map(type => {
          const colorClasses = getEventTypeColor(type).split(' ');
          const bgClass = colorClasses.find((c: string) => c.startsWith('bg-')) || '';
          const darkBgClass = colorClasses.find((c: string) => c.startsWith('dark:bg-')) || '';
          return (
            <div key={type} className="flex items-center gap-1">
              <div className={cn('w-3 h-3 rounded border', bgClass, darkBgClass)} />
              <span className="text-xs text-muted-foreground">
                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            </div>
          );
        })}
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