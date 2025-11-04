'use client';

import React from 'react';
import Link from 'next/link';
import { Beer, Clock, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Location } from '@/lib/types/location';
import { getLocationInfo, isLocationOpen, getFormattedHours } from '@/lib/config/locations';
import { cn } from '@/lib/utils';

interface QuickInfoCardsProps {
  beerCount?: { lawrenceville: number; zelienople: number };
  nextEvent?: { name: string; date: string; location: Location } | null;
  className?: string;
}

export function QuickInfoCards({ beerCount, nextEvent, className }: QuickInfoCardsProps) {
  const now = new Date();
  const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];

  // Get hours for both locations
  const lawrencevilleInfo = getLocationInfo(Location.LAWRENCEVILLE);
  const zelienopleInfo = getLocationInfo(Location.ZELIENOPLE);
  const lawrencevilleOpen = isLocationOpen(Location.LAWRENCEVILLE);
  const zelienopleOpen = isLocationOpen(Location.ZELIENOPLE);
  const lawrencevilleHours = getFormattedHours(Location.LAWRENCEVILLE, currentDay as keyof typeof lawrencevilleInfo.hours);
  const zelienopleHours = getFormattedHours(Location.ZELIENOPLE, currentDay as keyof typeof zelienopleInfo.hours);

  // Format next event date
  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(date);
    eventDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4", className)}>
      {/* On Tap Now Card */}
      <Link href="/beer" className="group">
        <Card className="p-5 h-full transition-all hover:scale-[1.02] cursor-pointer border-0">
          <div className="flex items-center gap-3 mb-3">
            <Beer className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-bold">On Tap Now</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {beerCount ? (
              <span className="space-y-0.5">
                <span className="block">{beerCount.lawrenceville} beers in Lawrenceville</span>
                <span className="block">{beerCount.zelienople} beers in Zelienople</span>
              </span>
            ) : (
              'Explore our current selection'
            )}
          </p>
        </Card>
      </Link>

      {/* Hours Today Card */}
      <Link href="/beer-map" className="group">
        <Card className="p-5 h-full transition-all hover:scale-[1.02] cursor-pointer border-0">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-bold">Hours Today</h3>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Lawrenceville:</span>
              <span className="font-medium">{lawrencevilleHours}</span>
            </div>
            <div className="flex justify-between">
              <span>Zelienople:</span>
              <span className="font-medium">{zelienopleHours}</span>
            </div>
          </div>
        </Card>
      </Link>

      {/* Next Event Card */}
      <Link href="/events" className="group">
        <Card className="p-5 h-full transition-all hover:scale-[1.02] cursor-pointer border-0">
          <div className="flex items-center gap-3 mb-3">
            <Calendar className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-bold">
              {nextEvent ? 'Next Event' : 'Upcoming Events'}
            </h3>
          </div>
          {nextEvent ? (
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground line-clamp-2">{nextEvent.name}</p>
              <p>{formatEventDate(nextEvent.date)} at {nextEvent.location === Location.LAWRENCEVILLE ? 'Lawrenceville' : 'Zelienople'}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Check out our event calendar
            </p>
          )}
        </Card>
      </Link>
    </div>
  );
}
