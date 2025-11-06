'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { DraftBeerCard } from '@/components/beer/draft-beer-card';
import type { Beer } from '@/lib/types/beer';
import Link from 'next/link';
import { useLocationFilteredData } from '@/lib/hooks/use-location-filtered-data';

interface FeaturedBeersProps {
  lawrencevilleBeers: Beer[];
  zelienopleBeers: Beer[];
  draftOnlyMode?: boolean;
}

export function FeaturedBeers({ lawrencevilleBeers, zelienopleBeers, draftOnlyMode = false }: FeaturedBeersProps) {
  const featuredBeers = useLocationFilteredData({
    lawrencevilleData: lawrencevilleBeers,
    zelienopleData: zelienopleBeers
  });

  if (draftOnlyMode) {
    return (
      <section className="h-full flex flex-col bg-background overflow-hidden">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex-1 flex flex-col py-8">
          <div className="text-center mb-6 flex-shrink-0">
            <h2 className="text-3xl lg:text-4xl font-bold">
              Draft
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-none" suppressHydrationWarning>
              {featuredBeers.map((beer, index) => (
                <DraftBeerCard
                  key={`${beer.variant}-${index}`}
                  beer={beer}
                  showLocation={false}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

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
