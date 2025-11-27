'use client';

import React from 'react';
import { HeroSection } from '@/components/home/hero-section';
import { FeaturedBeers } from '@/components/home/featured-menu';
import { QuickInfoCards } from '@/components/home/quick-info-cards';
import { LocationCards } from '@/components/location/location-cards';
import type { WeeklyHoursDay } from '@/lib/utils/payload-api';

interface HomeContentProps {
  availableBeers: any[];
  lawrencevilleBeers: any;
  zelienopleBeers: any;
  beerCount: { lawrenceville: number; zelienople: number };
  nextEvent: any;
  children: React.ReactNode;
  isAuthenticated?: boolean;
  heroDescription?: string;
  weeklyHours?: Record<string, WeeklyHoursDay[]>;
}

export function HomeContent({
  availableBeers,
  lawrencevilleBeers,
  zelienopleBeers,
  beerCount,
  nextEvent,
  children,
  isAuthenticated = false,
  heroDescription,
  weeklyHours,
}: HomeContentProps) {
  return (
    <div className="min-h-screen">
      <HeroSection availableBeers={availableBeers} heroDescription={heroDescription} />

      {/* Our Locations - right after hero */}
      <section className="py-16 lg:py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Our Locations
            </h2>
          </div>
          <LocationCards weeklyHours={weeklyHours} />
        </div>
      </section>

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
