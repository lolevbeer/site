/**
 * Food Schedule Component
 * Displays weekly food truck schedule with location awareness
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  FoodVendorSchedule,
  DayOfWeek,
  FoodVendorType,
  CuisineType,
  WeeklyFoodSchedule,
  DailyFoodSchedule
} from '@/lib/types/food';
import { Location, LocationDisplayNames } from '@/lib/types/location';
import { useLocationContext } from '@/components/location/location-provider';
import { VendorCard, VendorCardSkeleton } from './vendor-card';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  Truck,
  X,
  AlertCircle,
  ExternalLink,
  Instagram,
  Facebook
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FoodScheduleProps {
  schedules: FoodVendorSchedule[];
  className?: string;
  showLocationFilter?: boolean;
  variant?: 'weekly' | 'daily' | 'list';
  onVendorClick?: (schedule: FoodVendorSchedule) => void;
  loading?: boolean;
}

/**
 * Weekly food truck schedule component
 */
export function FoodSchedule({
  schedules,
  className,
  showLocationFilter = true,
  variant = 'weekly',
  onVendorClick,
  loading = false
}: FoodScheduleProps) {
  const { currentLocation, setLocation } = useLocationContext();
  const [currentWeek, setCurrentWeek] = useState(getStartOfWeek(new Date()));
  const [selectedLocation, setSelectedLocation] = useState<Location | undefined>(
    showLocationFilter ? currentLocation : undefined
  );
  const [selectedCuisines, setSelectedCuisines] = useState<CuisineType[]>([]);

  // Update local state when global location changes
  React.useEffect(() => {
    if (showLocationFilter) {
      setSelectedLocation(currentLocation);
    }
  }, [currentLocation, showLocationFilter]);

  // Get start of week (Sunday)
  function getStartOfWeek(date: Date): Date {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day;
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  // Generate weekly schedule
  const weeklySchedule = useMemo(() => {
    const days: DailyFoodSchedule[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeek);
      date.setDate(currentWeek.getDate() + i);
      date.setHours(0, 0, 0, 0);

      const daySchedules = schedules.filter(schedule => {
        // Compare date strings directly (YYYY-MM-DD format)
        const targetDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const scheduleDateStr = schedule.date.split('T')[0];

        // Filter by date
        if (scheduleDateStr !== targetDateStr) {
          return false;
        }

        // Filter by location
        if (selectedLocation && schedule.location !== selectedLocation) {
          return false;
        }

        // Filter by cuisine (would need vendor data)
        // This would typically be joined with vendor data
        if (selectedCuisines.length > 0) {
          // For now, skip cuisine filtering without vendor data
          return true;
        }

        return true;
      });

      days.push({
        date: date.toISOString().split('T')[0],
        day: Object.values(DayOfWeek)[date.getDay()],
        vendors: daySchedules,
        specialEvent: daySchedules.some(s => s.specialEvent)
      });
    }

    return days;
  }, [currentWeek, schedules, selectedLocation, selectedCuisines]);

  // Get today's schedule
  const todaysSchedule = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return weeklySchedule.find(day => {
      const [year, month, dayNum] = day.date.split('-').map(Number);
      const dayDate = new Date(year, month - 1, dayNum);
      dayDate.setHours(0, 0, 0, 0);
      return dayDate.getTime() === today.getTime();
    });
  }, [weeklySchedule]);

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
      if (timeString.includes('-')) {
        const [start, end] = timeString.split('-');
        return `${start.trim()}-${end.trim()}`;
      }
      return timeString;
    } catch {
      return timeString;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const isToday = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    const checkDate = new Date(year, month - 1, day);
    checkDate.setHours(0, 0, 0, 0);

    return checkDate.getTime() === today.getTime();
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

  const hasActiveFilters = selectedCuisines.length > 0 ||
    (showLocationFilter && selectedLocation !== currentLocation);

  const clearFilters = () => {
    setSelectedCuisines([]);
    setSelectedLocation(showLocationFilter ? currentLocation : undefined);
  };

  const getLinkIcon = (url: string | undefined) => {
    if (!url) return ExternalLink;
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('instagram.com') || lowerUrl.includes('instagr.am')) {
      return Instagram;
    }
    if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.com')) {
      return Facebook;
    }
    return ExternalLink;
  };

  const renderDaySchedule = (daySchedule: DailyFoodSchedule) => {
    if (loading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <VendorCardSkeleton key={i} variant="compact" />
          ))}
        </div>
      );
    }

    if (daySchedule.vendors.length === 0) {
      return (
        <div className="text-center py-8">
          <Truck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No vendors scheduled</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {daySchedule.vendors.map((schedule, index) => (
          <Card
            key={index}
            className="group cursor-pointer transition-all duration-300 hover:shadow-md border-gray-100"
            onClick={() => onVendorClick?.(schedule)}
          >
            <CardHeader className="pb-3">
              <div className="text-center">
                <CardTitle className="text-lg">{schedule.vendor}</CardTitle>
                <div className="mt-2 space-y-1">
                  <div className="text-sm text-muted-foreground">
                    {formatTime(schedule.time)}
                  </div>
                  {showLocationFilter && (
                    <div className="text-sm text-muted-foreground">
                      {LocationDisplayNames[schedule.location]}
                    </div>
                  )}
                </div>
                {(schedule.specialEvent || schedule.site) && (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    {schedule.specialEvent && (
                      <Badge variant="secondary" className="text-xs">
                        Special Event
                      </Badge>
                    )}
                    {schedule.site && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(schedule.site, '_blank');
                        }}
                      >
                        {React.createElement(getLinkIcon(schedule.site), {
                          className: "h-4 w-4"
                        })}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            {schedule.notes && (
              <CardContent className="pt-0 text-center">
                <p className="text-sm text-muted-foreground">{schedule.notes}</p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    );
  };

  if (variant === 'daily' && todaysSchedule) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Today's Food Trucks
          </h2>
          <span className="text-sm text-muted-foreground">
            {formatDate(todaysSchedule.date)}
          </span>
        </div>
        {renderDaySchedule(todaysSchedule)}
      </div>
    );
  }

  if (variant === 'list') {
    const filteredSchedules = schedules.filter(schedule => {
      if (selectedLocation && schedule.location !== selectedLocation) {
        return false;
      }
      return true;
    });

    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Food Truck Schedule</h2>
          {showLocationFilter && (
            <Tabs
              value={selectedLocation || 'all'}
              onValueChange={(value) => {
                const newLocation = value === 'all' ? undefined : value as Location;
                setSelectedLocation(newLocation);
                // Update global location if a specific location is selected
                if (newLocation) {
                  setLocation(newLocation);
                }
              }}
              className="w-auto"
            >
              <TabsList className="grid w-fit grid-cols-3">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value={Location.LAWRENCEVILLE}>
                  {LocationDisplayNames[Location.LAWRENCEVILLE]}
                </TabsTrigger>
                <TabsTrigger value={Location.ZELIENOPLE}>
                  {LocationDisplayNames[Location.ZELIENOPLE]}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>

        <div className="space-y-3">
          {filteredSchedules.map((schedule, index) => (
            <VendorCard
              key={index}
              vendor={{
                name: schedule.vendor,
                type: FoodVendorType.FOOD_TRUCK,
                cuisineTypes: [],
                active: true
              }}
              schedule={{
                date: schedule.date,
                time: formatTime(schedule.time),
                location: LocationDisplayNames[schedule.location]
              }}
              variant="compact"
              onVendorClick={() => onVendorClick?.(schedule)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6" />
            Food Truck Schedule
          </h2>
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
              className="min-w-[80px]"
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
            <Tabs
              value={selectedLocation || 'all'}
              onValueChange={(value) => {
                const newLocation = value === 'all' ? undefined : value as Location;
                setSelectedLocation(newLocation);
                // Update global location if a specific location is selected
                if (newLocation) {
                  setLocation(newLocation);
                }
              }}
              className="w-auto"
            >
              <TabsList className="grid w-fit grid-cols-3">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value={Location.LAWRENCEVILLE}>
                  {LocationDisplayNames[Location.LAWRENCEVILLE]}
                </TabsTrigger>
                <TabsTrigger value={Location.ZELIENOPLE}>
                  {LocationDisplayNames[Location.ZELIENOPLE]}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
      </div>

      {/* Week Range */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-muted-foreground">
          {weekRange}
        </h3>
      </div>

      {/* Today's Highlight */}
      {todaysSchedule && todaysSchedule.vendors.length > 0 && (
        <Card className="p-4 border-blue-100 bg-blue-50/50">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-blue-900">Today's Food Trucks</h3>
          </div>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {todaysSchedule.vendors.slice(0, 3).map((schedule, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-white rounded">
                <div>
                  <p className="font-medium text-sm">{schedule.vendor}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(schedule.time)} • {LocationDisplayNames[schedule.location]}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {todaysSchedule.vendors.length > 3 && (
            <p className="text-xs text-blue-600 mt-2">
              +{todaysSchedule.vendors.length - 3} more vendors today
            </p>
          )}
        </Card>
      )}

      {/* Weekly Calendar View */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {weeklySchedule.map((daySchedule, index) => (
          <Card
            key={index}
            className={cn(
              'min-h-[300px] p-4',
              isToday(daySchedule.date) && 'ring-1 ring-blue-300 ring-opacity-50 bg-blue-50/50',
              daySchedule.vendors.length === 0 && 'bg-muted/30'
            )}
          >
            <div className="space-y-3">
              {/* Day Header */}
              <div className="text-center border-b border-gray-100 pb-2">
                <h3 className={cn(
                  'font-semibold',
                  isToday(daySchedule.date) && 'text-blue-600'
                )}>
                  {daySchedule.day}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {(() => {
                    const [year, month, day] = daySchedule.date.split('-').map(Number);
                    return day;
                  })()}
                </p>
                {daySchedule.specialEvent && (
                  <Badge variant="secondary" className="text-xs mt-1">
                    Special Event
                  </Badge>
                )}
              </div>

              {/* Day Schedule */}
              {renderDaySchedule(daySchedule)}
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {weeklySchedule.every(day => day.vendors.length === 0) && !loading && (
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Food Trucks Scheduled</h3>
          <p className="text-muted-foreground mb-4">
            There are no food trucks scheduled for this week.
          </p>
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}

/**
 * Compact food schedule for smaller spaces
 */
export function CompactFoodSchedule({
  schedules,
  className,
  maxItems = 5
}: {
  schedules: FoodVendorSchedule[];
  className?: string;
  maxItems?: number;
}) {
  return (
    <FoodSchedule
      schedules={schedules.slice(0, maxItems)}
      className={cn('max-w-2xl', className)}
      showLocationFilter={false}
      variant="list"
    />
  );
}

export default FoodSchedule;