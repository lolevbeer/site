'use client';

import React, { useEffect, useState } from 'react';
import { HeroSection } from '@/components/home/hero-section';
import { FeaturedBeers } from '@/components/home/featured-beers';
import { FeaturedCans } from '@/components/home/featured-cans';
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
}

export function HomeContent({
  availableBeers,
  lawrencevilleBeers,
  zelienopleBeers,
  lawrencevilleCans = [],
  zelienopleCans = [],
  beerCount,
  nextEvent,
  children
}: HomeContentProps) {
  const [isDraftOnly, setIsDraftOnly] = useState(false);
  const [isCansOnly, setIsCansOnly] = useState(false);

  useEffect(() => {
    // Check if hash is #draft or #cans
    const checkHash = () => {
      const hash = window.location.hash;
      setIsDraftOnly(hash === '#draft');
      setIsCansOnly(hash === '#cans');
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);

    return () => {
      window.removeEventListener('hashchange', checkHash);
    };
  }, []);

  if (isDraftOnly) {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col">
        <FeaturedBeers
          lawrencevilleBeers={lawrencevilleBeers}
          zelienopleBeers={zelienopleBeers}
          draftOnlyMode={true}
        />
      </div>
    );
  }

  if (isCansOnly) {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col">
        <FeaturedCans
          lawrencevilleCans={lawrencevilleCans}
          zelienopleCans={zelienopleCans}
          cansOnlyMode={true}
        />
      </div>
    );
  }

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
        lawrencevilleBeers={lawrencevilleBeers}
        zelienopleBeers={zelienopleBeers}
      />

      {children}
    </div>
  );
}
