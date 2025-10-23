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
}

interface FeaturedCansProps {
  lawrencevilleCans: Can[];
  zelienopleCans: Can[];
}

export function FeaturedCans({ lawrencevilleCans, zelienopleCans }: FeaturedCansProps) {
  const featuredCans = useLocationFilteredData({
    lawrencevilleData: lawrencevilleCans,
    zelienopleData: zelienopleCans
  });

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
                <Link key={`${beer.variant}-${index}`} href={`/beer/${beer.variant.toLowerCase()}`} className="group">
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col border-0 h-full cursor-pointer bg-[var(--color-card-interactive)]">
                    <div className={`relative h-48 w-full flex-shrink-0 ${beer.image ? 'bg-gradient-to-b from-muted/5 to-background/20' : ''}`}>
                      {beer.image ? (
                        <Image
                          src={`/images/beer/${beer.variant.toLowerCase()}.webp`}
                          alt={`${beer.name} - ${beer.type || 'Craft beer'} can`}
                          fill
                          className="object-contain p-4"
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
                    <CardContent className="p-4 flex flex-col flex-grow">
                      <div className="flex-grow">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold">{beer.name}</h3>
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
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {beer.type}
                          </Badge>
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
