'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useLocationContext } from '@/components/location/location-provider';
import { DraftBeerCard } from '@/components/beer/draft-beer-card';
import type { Beer } from '@/lib/types/beer';
import Link from 'next/link';

interface FeaturedBeersProps {
  lawrencevilleBeers: Beer[];
  zelienopleBeers: Beer[];
}

export function FeaturedBeers({ lawrencevilleBeers, zelienopleBeers }: FeaturedBeersProps) {
  const { currentLocation } = useLocationContext();
  const [isHydrated, setIsHydrated] = useState(false);

  // Track hydration to prevent mismatch
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Filter beers based on current location
  // Always show lawrenceville before hydration to prevent mismatch
  const featuredBeers = useMemo(() => {
    if (!isHydrated) {
      return lawrencevilleBeers;
    }
    if (currentLocation === 'lawrenceville') {
      return lawrencevilleBeers;
    } else if (currentLocation === 'zelienople') {
      return zelienopleBeers;
    }
    // Show both locations when 'all' is selected
    return [...lawrencevilleBeers, ...zelienopleBeers];
  }, [currentLocation, lawrencevilleBeers, zelienopleBeers, isHydrated]);

  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Draft
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8" suppressHydrationWarning>
          {featuredBeers.map((beer, index) => (
            <DraftBeerCard
              key={`${beer.variant}-${index}`}
              beer={beer}
              showLocation={false}
              priority={index === 0}
            />
          ))}
        </div>

        <div className="text-center">
          <Button asChild variant="default" size="lg">
            <Link href="/beer">
              View All Beer
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
