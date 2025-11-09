'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Location, type LocationHours } from '@/lib/types/location';
import { LOCATIONS_DATA } from '@/lib/config/locations';
import { trackDirections } from '@/lib/analytics/events';
import { formatTime } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

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

function HoursDisplay({ hours }: { hours: LocationHours }) {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = dayNames[new Date().getDay()] as DayOfWeek;

  return (
    <div className="space-y-1 text-sm">
      {Object.entries(hours).map(([day, dayHours]) => {
        if (day === 'notes') return null;

        const isToday = day === today;
        const dayName = getDayName(day as DayOfWeek);

        return (
          <div
            key={day}
            className={cn(
              'flex justify-between',
              isToday && 'font-semibold text-primary'
            )}
          >
            <span>{dayName}</span>
            <span>
              {dayHours.closed
                ? 'Closed'
                : `${formatTime(dayHours.open)} - ${formatTime(dayHours.close)}`
              }
            </span>
          </div>
        );
      })}
      {hours.notes && (
        <p className="mt-2 text-xs text-muted-foreground italic">
          {hours.notes}
        </p>
      )}
    </div>
  );
}

export function LocationCards() {


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
              <HoursDisplay hours={data.hours} />
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