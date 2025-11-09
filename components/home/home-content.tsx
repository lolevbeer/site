'use client';

import React from 'react';
import { HeroSection } from '@/components/home/hero-section';
import { FeaturedBeers } from '@/components/home/featured-beers';
import { QuickInfoCards } from '@/components/home/quick-info-cards';

interface HomeContentProps {
  availableBeers: any[];
  lawrencevilleBeers: any[];
  zelienopleBeers: any[];
  lawrencevilleCans?: any[];
  zelienopleCans?: any[];
  beerCount: { lawrenceville: number; zelienople: number };
  nextEvent: any;
  children: React.ReactNode;
  isAuthenticated?: boolean;
}

export function HomeContent({
  availableBeers,
  lawrencevilleBeers,
  zelienopleBeers,
  lawrencevilleCans = [],
  zelienopleCans = [],
  beerCount,
  nextEvent,
  children,
  isAuthenticated = false,
}: HomeContentProps) {
  return (
    <div className="min-h-screen">
      <HeroSection availableBeers={availableBeers} />

      {/* Vertical spacing between major sections */}
      <div className="py-8 md:py-12" />

      {/* Quick Info Cards */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8">
        <QuickInfoCards beerCount={beerCount} nextEvent={nextEvent} />
      </section>

      <div className="py-8 md:py-12" />

      <FeaturedBeers
        menus={[lawrencevilleBeers, zelienopleBeers].filter(Boolean)}
        isAuthenticated={isAuthenticated}
      />

      {children}
    </div>
  );
}
