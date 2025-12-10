'use client';

import React from 'react';
import { Clock, MapPin } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toLocationInfo } from '@/lib/types/location';
import { isLocationOpenNow } from '@/lib/config/locations';
import { cn } from '@/lib/utils';
import { useLocationContext } from './location-provider';
import type { WeeklyHoursDay, DayOfWeek } from '@/lib/utils/payload-api';

function formatTime(time: string | null, timezone: string = 'America/New_York'): string {
  if (!time) return '';
  // Handle ISO date strings from Payload (time only fields store as full ISO)
  if (time.includes('T')) {
    const date = new Date(time);
    const minutes = date.getMinutes();
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: minutes === 0 ? undefined : '2-digit',
      hour12: true,
      timeZone: timezone,
    });
  }
  // Handle HH:mm format (legacy/fallback)
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  if (minutes === 0) {
    return `${displayHours} ${ampm}`;
  }
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function formatHoursString(dayData: WeeklyHoursDay): string {
  if (dayData.closed) return 'Closed';
  return `${formatTime(dayData.open, dayData.timezone)} - ${formatTime(dayData.close, dayData.timezone)}`;
}

interface HoursPanelProps {
  weeklyHours?: Record<string, WeeklyHoursDay[]>;
  className?: string;
}

export function HoursPanel({
  weeklyHours,
  className
}: HoursPanelProps) {
  const { locations } = useLocationContext();
  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()] as DayOfWeek;

  return (
    <Card className={cn("p-0 border-0 shadow-none bg-transparent dark:bg-transparent", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">Hours & Locations</h2>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {locations.map((location) => {
          const slug = location.slug || location.id;
          const locationInfo = toLocationInfo(location);
          const isOpen = isLocationOpenNow(location);
          const locationWeeklyHours = weeklyHours?.[slug];
          const todayData = locationWeeklyHours?.find(d => d.day === currentDay);
          const todayHours = todayData ? formatHoursString(todayData) : 'Hours not available';

          return (
            <AccordionItem key={slug} value={slug} className="border-0">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div className="text-left">
                      <div className="font-semibold">Lolev {location.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {locationInfo.address}, {locationInfo.city}, {locationInfo.state} {locationInfo.zipCode}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={isOpen ? "default" : "secondary"} className="ml-2">
                      {isOpen ? "Open Now" : "Closed"}
                    </Badge>
                    <div className="text-sm text-muted-foreground hidden sm:block">
                      {todayHours}
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-4 pl-7 space-y-2">
                  {/* Today's hours - shown on mobile */}
                  <div className="sm:hidden mb-3 pb-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Today</span>
                      <span className="text-muted-foreground">{todayHours}</span>
                    </div>
                  </div>

                  {/* Weekly schedule */}
                  {locationWeeklyHours ? (
                    <>
                      {locationWeeklyHours.some(d => d.holidayName) && (
                        <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-border">
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                            ⚠ Special hours this week
                          </span>
                        </div>
                      )}
                      {locationWeeklyHours.map((dayData) => {
                        const isToday = dayData.day === currentDay;
                        const isSpecial = !!dayData.holidayName;

                        return (
                          <div
                            key={dayData.day}
                            className={cn(
                              "flex justify-between items-center py-1.5 px-2 rounded",
                              isToday && "bg-primary/5 font-medium",
                              isSpecial && !isToday && "text-amber-600 dark:text-amber-400"
                            )}
                          >
                            <span className="capitalize flex items-center gap-2">
                              {dayData.day}
                              {dayData.holidayName && (
                                <Badge variant="outline" className="text-xs py-0 px-1.5 border-amber-500 text-amber-600 dark:text-amber-400">
                                  {dayData.holidayName}
                                </Badge>
                              )}
                            </span>
                            <span className={cn(!isSpecial && "text-muted-foreground")}>
                              {formatHoursString(dayData)}
                            </span>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Hours not available</p>
                  )}

                  {/* Contact info */}
                  <div className="pt-4 mt-4 space-y-2">
                    {locationInfo.phone && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Phone: </span>
                        <a href={`tel:${locationInfo.phone}`} className="hover:underline">
                          {locationInfo.phone}
                        </a>
                      </div>
                    )}
                    <div className="text-sm">
                      <span className="text-muted-foreground">Address: </span>
                      <a
                        href={locationInfo.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {locationInfo.address}, {locationInfo.city}, {locationInfo.state} {locationInfo.zipCode}
                      </a>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </Card>
  );
}
