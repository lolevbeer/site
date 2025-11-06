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
import { Location, LocationDisplayNames } from '@/lib/types/location';
import { getLocationInfo, isLocationOpen, getFormattedHours } from '@/lib/config/locations';
import { cn } from '@/lib/utils';

interface HoursPanelProps {
  locations?: Location[];
  className?: string;
}

export function HoursPanel({ locations = [Location.LAWRENCEVILLE, Location.ZELIENOPLE], className }: HoursPanelProps) {
  const now = new Date();
  const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];

  return (
    <Card className={cn("p-0 border-0 shadow-none", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold">Hours & Locations</h2>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {locations.map((location) => {
          const locationInfo = getLocationInfo(location);
          const isOpen = isLocationOpen(location);
          const todayHours = getFormattedHours(location, currentDay as keyof typeof locationInfo.hours);

          return (
            <AccordionItem key={location} value={location} className="border-0">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div className="text-left">
                      <div className="font-semibold">Lolev {LocationDisplayNames[location]}</div>
                      <div className="text-sm text-muted-foreground">{locationInfo.address}, {locationInfo.city}, {locationInfo.state} {locationInfo.zipCode}</div>
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
                  {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => {
                    const hours = getFormattedHours(location, day);
                    const isToday = day === currentDay;

                    return (
                      <div
                        key={day}
                        className={cn(
                          "flex justify-between items-center py-1.5 px-2 rounded",
                          isToday && "bg-primary/5 font-medium"
                        )}
                      >
                        <span className="capitalize">
                          {day}
                        </span>
                        <span className="text-muted-foreground">{hours}</span>
                      </div>
                    );
                  })}

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
