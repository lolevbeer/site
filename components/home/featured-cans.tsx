'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getGlassIcon } from '@/lib/utils/beer-icons';
import { useLocationFilteredData } from '@/lib/hooks/use-location-filtered-data';

interface Can {
  variant: string;
  name: string;
  type?: string;
  abv?: string;
  image?: boolean;
  onDraft?: boolean;
  glass?: string;
  fourPack?: string;
}

interface FeaturedCansProps {
  lawrencevilleCans: Can[];
  zelienopleCans: Can[];
  cansOnlyMode?: boolean;
}

export function FeaturedCans({ lawrencevilleCans, zelienopleCans, cansOnlyMode = false }: FeaturedCansProps) {
  const featuredCans = useLocationFilteredData({
    lawrencevilleData: lawrencevilleCans,
    zelienopleData: zelienopleCans
  });

  if (cansOnlyMode) {
    return (
      <section className="h-full flex flex-col bg-background overflow-hidden">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex-1 flex flex-col py-8">
          <div className="text-center mb-6 flex-shrink-0">
            <h2 className="text-3xl lg:text-4xl font-bold">
              Cans
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {featuredCans.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-4 max-w-none auto-rows-min" suppressHydrationWarning>
                {featuredCans.map((beer, index) => (
                  <div key={`${beer.variant}-${index}`} className="group" style={{ width: '15vw', minWidth: '180px', maxWidth: '250px', height: 'auto' }}>
                    <div className="relative w-full" style={{ height: '65vh', maxHeight: '650px' }}>
                      {beer.image ? (
                        <Image
                          src={`/images/beer/${beer.variant.toLowerCase()}.webp`}
                          alt={`${beer.name} - ${beer.type || 'Craft beer'} can`}
                          fill
                          className="object-contain"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
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
                      <div className="absolute top-1/2 -translate-y-1/2 right-4 flex flex-col items-start gap-2">
                        <h3 className="text-lg font-semibold bg-background/90 px-2 py-1 rounded">{beer.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {beer.type}
                        </Badge>
                        {beer.onDraft && (() => {
                          const GlassIcon = getGlassIcon(beer.glass);
                          return (
                            <Badge variant="default" className="text-xs flex-shrink-0 flex items-center gap-1">
                              <GlassIcon className="h-3 w-3" />
                              Pouring
                            </Badge>
                          );
                        })()}
                        {beer.fourPack && (
                          <div className="text-sm font-semibold bg-background/90 px-2 py-1 rounded">
                            ${beer.fourPack} 4 pack
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-xl font-semibold mb-2">No cans available</p>
                <p className="text-muted-foreground">
                  Check back soon for cans to take home.
                </p>
              </div>
            )}
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
            Cans
          </h2>
        </div>

        <div className="mb-8">
          {featuredCans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" suppressHydrationWarning>
              {featuredCans.map((beer, index) => (
                <div key={`${beer.variant}-${index}`} className="group flex flex-col">
                  <div className="relative h-64 w-full flex-shrink-0 mb-4">
                    {beer.image ? (
                      <Image
                        src={`/images/beer/${beer.variant.toLowerCase()}.webp`}
                        alt={`${beer.name} - ${beer.type || 'Craft beer'} can`}
                        fill
                        className="object-contain"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
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
                  <div className="mb-3">
                    <div className="flex items-center justify-center gap-2 flex-wrap mb-2">
                      <h3 className="text-lg font-semibold">{beer.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {beer.type}
                      </Badge>
                      {beer.onDraft && (() => {
                        const GlassIcon = getGlassIcon(beer.glass);
                        return (
                          <Badge variant="default" className="text-xs flex-shrink-0 flex items-center gap-1">
                            <GlassIcon className="h-3 w-3" />
                            Pouring
                          </Badge>
                        );
                      })()}
                    </div>
                  </div>
                  <Button asChild variant="outline" size="default" className="w-full">
                    <Link href={`/beer/${beer.variant.toLowerCase()}`}>
                      View Details
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-xl font-semibold mb-2">No cans available</p>
              <p className="text-muted-foreground">
                Check back soon for cans to take home.
              </p>
            </div>
          )}
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
