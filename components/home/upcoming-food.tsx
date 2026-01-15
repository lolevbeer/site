'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { useLocationFilteredData, type LocationData } from '@/lib/hooks/use-location-filtered-data';
import { formatDate, formatTime } from '@/lib/utils/formatters';
import { useSortedItems } from '@/lib/hooks/use-sorted-items';
import { useLocationContext } from '@/components/location/location-provider';
import type { LocationSlug } from '@/lib/types/location';

interface FoodVendor {
  vendor: string | {
    id?: string;
    name?: string;
    site?: string | null;
    logo?: string | { url?: string } | null;
  };
  date: string;
  time?: string;
  startTime?: string; // PayloadFood uses startTime
  site?: string | null;
  day?: string;
  location?: LocationSlug | { slug?: string } | string;
}

interface UpcomingFoodProps {
  /** Food organized by location slug */
  foodByLocation: Record<string, FoodVendor[]>;
}

export function UpcomingFood({ foodByLocation }: UpcomingFoodProps): React.ReactElement | null {
  const { locations } = useLocationContext();

  // Create data structure for location filtering with location attached
  const dataByLocation = useMemo(() => {
    const result: LocationData<FoodVendor & { location: LocationSlug }> = {};
    for (const [locationSlug, foods] of Object.entries(foodByLocation)) {
      result[locationSlug] = foods.map(f => ({ ...f, location: locationSlug }));
    }
    return result;
  }, [foodByLocation]);

  // Filter by current location and take first 3
  const filteredFood = useLocationFilteredData({ dataByLocation });
  const upcomingFood = useSortedItems(filteredFood, { limit: 3 });

  /** Get location display name from slug or object */
  function getLocationDisplayName(location: LocationSlug | { slug?: string; name?: string } | string | undefined): string {
    if (!location) return '';
    if (typeof location === 'object' && location.name) return location.name;
    const slug = typeof location === 'object' ? location.slug : location;
    if (!slug) return '';
    return locations.find(l => l.slug === slug || l.id === slug)?.name || slug;
  }

  if (upcomingFood.length === 0) {
    return null;
  }

  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeader
            title="Upcoming Food"
            adminUrl="/admin/collections/food"
          />
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {upcomingFood.map((food, index) => {
            const vendorName = typeof food.vendor === 'object' ? food.vendor?.name : food.vendor;
            const vendorSite = food.site || (typeof food.vendor === 'object' ? food.vendor?.site : undefined);
            const vendorLogo = typeof food.vendor === 'object' && food.vendor?.logo
              ? (typeof food.vendor.logo === 'object' ? food.vendor.logo?.url : food.vendor.logo)
              : undefined;
            const timeDisplay = food.time || food.startTime;

            return (
              <Card
                key={index}
                className={`overflow-hidden transition-colors shadow-none bg-transparent ${vendorSite ? 'border border-border cursor-pointer hover:bg-secondary' : ''}`}
                onClick={vendorSite ? () => window.open(vendorSite, '_blank') : undefined}
              >
                <CardContent className={`p-4 ${vendorLogo ? 'flex items-center gap-4' : 'text-center py-6'}`}>
                  {vendorLogo && (
                    <div className="relative w-16 h-16 flex-shrink-0 rounded-full overflow-hidden bg-muted">
                      <Image
                        src={vendorLogo}
                        alt={`${vendorName} logo`}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>
                  )}
                  <div className={vendorLogo ? 'flex-1 min-w-0' : ''}>
                    <h3 className="text-lg font-semibold">{vendorName}</h3>
                    <div className="text-sm text-muted-foreground">
                      <span>{formatDate(food.date, 'full')}</span>
                      {timeDisplay && <span> • {formatTime(timeDisplay)}</span>}
                      <span> • {getLocationDisplayName(food.location)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
