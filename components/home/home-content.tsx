import React from 'react';
import { HeroSection } from '@/components/home/hero-section';
import { FeaturedBeers } from '@/components/home/featured-menu';
import { QuickInfoCards } from '@/components/home/quick-info-cards';
import { LocationCards } from '@/components/location/location-cards';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import type { WeeklyHoursDay } from '@/lib/utils/payload-api';
import type { Menu as PayloadMenu } from '@/src/payload-types';
import type { LocationSlug } from '@/lib/types/location';
import type { HeroBeerView } from '@/lib/utils/homepage-view-models';

interface HomeContentProps {
  heroBeers: HeroBeerView[];
  /** All draft menus from all locations */
  draftMenus: PayloadMenu[];
  /** Draft tap count by location slug */
  beerCount: Record<string, number>;
  /** Cans count by location slug */
  cansCount: Record<string, number>;
  nextEvent: { name: string; date: string; location: LocationSlug } | null;
  children: React.ReactNode;
  heroDescription?: string;
  heroImageUrl?: string | null;
  weeklyHours?: Record<string, WeeklyHoursDay[]>;
}

export function HomeContent({
  heroBeers,
  draftMenus,
  beerCount,
  cansCount,
  nextEvent,
  children,
  heroDescription,
  heroImageUrl,
  weeklyHours,
}: HomeContentProps) {
  return (
    <div className="min-h-screen">
      <HeroSection beers={heroBeers} heroDescription={heroDescription} heroImageUrl={heroImageUrl} />

      {/* Our Locations - right after hero */}
      <section className="py-16 lg:py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                Our Locations
              </h2>
            </div>
          </ScrollReveal>
          <LocationCards weeklyHours={weeklyHours} />
        </div>
      </section>

      {/* Quick Info Cards */}
      <section className="py-16 lg:py-24 container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <QuickInfoCards beerCount={beerCount} cansCount={cansCount} nextEvent={nextEvent} />
        </ScrollReveal>
      </section>

      <FeaturedBeers menus={draftMenus} />

      {children}
    </div>
  );
}
