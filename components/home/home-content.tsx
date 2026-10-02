'use client'

import React from 'react'
import { HeroSection } from '@/components/home/hero-section'
import { FeaturedBeers } from '@/components/home/featured-menu'
import { QuickInfoCards } from '@/components/home/quick-info-cards'
import { LocationCards } from '@/components/location/location-cards'
import { useLocationContext } from '@/components/location/location-provider'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import type { WeeklyHoursDay } from '@/lib/utils/payload-api'
import type { Menu as PayloadMenu } from '@/src/payload-types'
import type { HeroCanBeer } from '@/lib/utils/public-client-payloads'

interface HomeContentProps {
  /** Cans-menu beers for the hero carousel, projected by the server page. */
  heroBeers: HeroCanBeer[]
  /** All draft menus from all locations */
  draftMenus: PayloadMenu[]
  /** Draft tap count by location slug */
  beerCount: Record<string, number>
  /** Cans count by location slug */
  cansCount: Record<string, number>
  children: React.ReactNode
  heroDescription?: string
  heroImageUrl?: string | null
  weeklyHours?: Record<string, WeeklyHoursDay[]>
}

export function HomeContent({
  heroBeers,
  draftMenus,
  beerCount,
  cansCount,
  children,
  heroDescription,
  heroImageUrl,
  weeklyHours,
}: HomeContentProps) {
  const { locations } = useLocationContext()
  return (
    <div className="min-h-screen">
      <HeroSection
        heroBeers={heroBeers}
        heroDescription={heroDescription}
        heroImageUrl={heroImageUrl}
      >
        <QuickInfoCards beerCount={beerCount} cansCount={cansCount} weeklyHours={weeklyHours} />
      </HeroSection>

      {/* Our Locations - right after hero */}
      <section className="py-16 lg:py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">Our Locations</h2>
              {locations.length > 0 ? (
                <p className="text-muted-foreground">
                  {new Intl.ListFormat('en').format(locations.map((location) => location.name))}:
                  hours, directions, food, events, and what is on tap.
                </p>
              ) : null}
            </div>
          </ScrollReveal>
          <LocationCards weeklyHours={weeklyHours} />
        </div>
      </section>

      <FeaturedBeers menus={draftMenus} />

      {children}
    </div>
  )
}
