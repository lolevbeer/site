'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, Pencil } from 'lucide-react';
import { useLocationFilteredData, type LocationData } from '@/lib/hooks/use-location-filtered-data';
import { useLocationContext } from '@/components/location/location-provider';
import type { LocationSlug } from '@/lib/types/location';

interface FoodVendor {
  vendor: string;
  date: string;
  time?: string;
  site?: string;
  day?: string;
  location?: LocationSlug;
}

interface UpcomingFoodProps {
  /** Food organized by location slug */
  foodByLocation: Record<string, FoodVendor[]>;
  isAuthenticated?: boolean;
}

export function UpcomingFood({ foodByLocation, isAuthenticated }: UpcomingFoodProps) {
  const { locations } = useLocationContext();

  // Create data structure for location filtering with location attached
  const dataByLocation = useMemo(() => {
    const result: LocationData<FoodVendor & { location: LocationSlug }> = {};
    for (const [locationSlug, foods] of Object.entries(foodByLocation)) {
      result[locationSlug] = foods.map(f => ({ ...f, location: locationSlug }));
    }
    return result;
  }, [foodByLocation]);

  // Filter by current location
  const filteredFood = useLocationFilteredData({ dataByLocation });

  // Sort and take first 3
  const upcomingFood = useMemo(() => {
    const sorted = [...filteredFood].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    return sorted.slice(0, 3);
  }, [filteredFood]);

  // Helper to get location display name
  const getLocationDisplayName = (slug: LocationSlug): string => {
    const location = locations.find(loc => loc.slug === slug || loc.id === slug);
    return location?.name || slug;
  };

  if (upcomingFood.length === 0) {
    return null;
  }

  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1" />
            <h2 className="text-3xl lg:text-4xl font-bold">
              Upcoming Food
            </h2>
            <div className="flex-1 flex justify-end">
              {isAuthenticated && (
                <Button asChild variant="outline" size="sm">
                  <a href="/admin/collections/food" target="_blank" rel="noopener noreferrer">
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 justify-items-center">
          {upcomingFood.map((food, index) => (
            <Card
              key={index}
              className={`overflow-hidden transition-colors border-0 shadow-none bg-transparent dark:bg-transparent ${food.site ? 'cursor-pointer hover:bg-secondary' : ''}`}
              onClick={() => food.site && window.open(food.site, '_blank')}
            >
              <CardContent className="p-6 text-center">
                <h3 className="text-xl font-semibold mb-2">{food.vendor}</h3>
                <div className="space-y-2 text-sm text-muted-foreground flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{(() => {
                      const date = new Date(food.date);
                      return date.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        timeZone: 'America/New_York'
                      });
                    })()}</span>
                  </div>
                  {food.time && food.time !== 'TBD' && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{food.time}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{getLocationDisplayName(food.location)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button asChild variant="outline" size="lg">
            <Link href="/food">
              View All
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
