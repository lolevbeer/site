'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocationContext } from '@/components/location/location-provider';

interface Beer {
  tap?: string;
  variant: string;
  name: string;
  type: string;
  abv: string;
  glass?: string;
  price?: string;
  description?: string;
  image?: boolean;
  cansAvailable?: boolean;
}

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8" suppressHydrationWarning>
          {featuredBeers.map((beer, index) => (
            <Link key={`${beer.variant}-${index}`} href={`/beer/${beer.variant.toLowerCase()}`} className="group">
              <Card className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col border-0 h-full cursor-pointer bg-[var(--color-card-interactive)]">
                <div className={`relative h-48 w-full flex-shrink-0 ${beer.image ? 'bg-gradient-to-b from-muted/5 to-background/20' : ''}`}>
                  {beer.image ? (
                    <Image
                      src={`/images/beer/${beer.variant.toLowerCase()}.webp`}
                      alt={beer.name}
                      fill
                      className="object-contain p-4"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      priority={index === 0}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center px-4">
                        <div className="text-2xl font-bold text-muted-foreground/30 mb-2">
                          {beer.name}
                        </div>
                        <div className="text-sm text-muted-foreground/30">
                          {beer.type}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <CardContent className="p-4 flex flex-col flex-grow">
                  <div className="flex-grow">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <h3 className="text-lg font-semibold">{beer.name}</h3>
                      <div className="flex gap-1 flex-shrink-0 items-center">
                        {beer.cansAvailable && (
                          <Badge variant="default" className="text-xs whitespace-nowrap">
                            Cans
                          </Badge>
                        )}
                        {beer.tap && (
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">
                            Tap {beer.tap}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div>{beer.type}</div>
                      <div>{beer.abv}% ABV</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Button variant="ghost" size="sm" className="w-full pointer-events-none">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="text-center">
          <Button asChild variant="default" size="lg">
            <Link href="/beer">
              View All Beers
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
