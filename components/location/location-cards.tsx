'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Location } from '@/lib/types/location';
import { LOCATIONS_DATA } from '@/lib/config/locations';
import { trackDirections } from '@/lib/analytics/events';
import { cn } from '@/lib/utils';
import type { WeeklyHoursDay, DayOfWeek } from '@/lib/utils/payload-api';

function getDayName(day: DayOfWeek): string {
  const dayNames: Record<DayOfWeek, string> = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  };
  return dayNames[day];
}

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

function HoursDisplay({ weeklyHours }: { weeklyHours: WeeklyHoursDay[] }) {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = dayNames[new Date().getDay()] as DayOfWeek;
  const hasSpecialHours = weeklyHours.some(d => d.holidayName);

  return (
    <div className="space-y-1 text-sm">
      {hasSpecialHours && (
        <div className="flex items-center justify-center gap-1.5 mb-2 pb-2 border-b border-border">
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            ⚠ Special hours this week
          </span>
        </div>
      )}
      {weeklyHours.map((dayData) => {
        const isToday = dayData.day === today;
        const isSpecial = !!dayData.holidayName;

        return (
          <div
            key={dayData.day}
            className={cn(
              'flex justify-between items-center gap-2',
              isToday && 'font-semibold text-primary',
              isSpecial && !isToday && 'text-amber-600 dark:text-amber-400'
            )}
          >
            <span className="flex items-center gap-2">
              {getDayName(dayData.day)}
              {dayData.holidayName && (
                <Badge variant="outline" className="text-xs py-0 px-1.5 border-amber-500 text-amber-600 dark:text-amber-400">
                  {dayData.holidayName}
                </Badge>
              )}
            </span>
            <span>
              {dayData.closed
                ? 'Closed'
                : `${formatTime(dayData.open, dayData.timezone)} - ${formatTime(dayData.close, dayData.timezone)}`
              }
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface LocationCardsProps {
  weeklyHours?: Record<string, WeeklyHoursDay[]>;
}

export function LocationCards({ weeklyHours }: LocationCardsProps) {


  const locations = [
    {
      id: Location.LAWRENCEVILLE,
      data: LOCATIONS_DATA[Location.LAWRENCEVILLE],
      gradient: 'from-amber-200 to-orange-300',
      displayName: 'Lawrenceville',
      image: '/images/Lawrenceville-front.jpg'
    },
    {
      id: Location.ZELIENOPLE,
      data: LOCATIONS_DATA[Location.ZELIENOPLE],
      gradient: 'from-green-200 to-blue-300',
      displayName: 'Zelienople',
      image: '/images/Zelienople-interior.jpg'
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
      {locations.map(({ id, data, gradient, displayName, image }) => (
        <div key={id} className="flex flex-col relative pb-16">
          {/* Location Image */}
          <div className="aspect-video relative mb-6">
            {image ? (
              <Image
                src={image}
                alt={`${displayName} location`}
                fill
                className="object-cover rounded-lg"
                priority={id === Location.LAWRENCEVILLE}
                fetchPriority={id === Location.LAWRENCEVILLE ? "high" : "low"}
                quality={85}
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div className={`h-full bg-gradient-to-br ${gradient} rounded-lg`} />
            )}
          </div>

          {/* Location Info */}
          <div className="flex flex-col items-center text-center space-y-4">
            <h3 className="text-2xl font-bold">{displayName}</h3>

            {/* Address */}
            <div className="text-muted-foreground text-lg">
              <p>{data.address}</p>
              <p>{data.city}, {data.state} {data.zipCode}</p>
            </div>

            {/* Hours */}
            <div className="w-full max-w-xs">
              <p className="font-semibold mb-2">Hours</p>
              {weeklyHours && weeklyHours[id] ? (
                <HoursDisplay weeklyHours={weeklyHours[id]} />
              ) : (
                <p className="text-sm text-muted-foreground">Hours not available</p>
              )}
            </div>

            {/* Phone */}
            {data.phone && (
              <div className="text-muted-foreground">
                <a href={`tel:${data.phone}`} className="hover:underline">
                  {data.phone}
                </a>
              </div>
            )}
          </div>

          {/* Map Link Button - Positioned absolutely at bottom */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-center">
            <Button asChild variant="default" size="default" className="w-full max-w-xs">
              <Link
                href={data.mapUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackDirections(displayName)}
              >
                Get Directions
              </Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}