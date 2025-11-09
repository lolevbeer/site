'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getGlassIcon } from '@/lib/utils/beer-icons';
import { useLocationFilteredData } from '@/lib/hooks/use-location-filtered-data';
import { useLocationContext } from '@/components/location/location-provider';
import { Pencil } from 'lucide-react';

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
  menu?: any; // Menu from Payload with items (beers) - for fullscreen mode
  menus?: any[]; // Array of menus from different locations
  isAuthenticated?: boolean; // Whether user is authenticated
  // Legacy props for backward compatibility
  lawrencevilleCans?: any;
  zelienopleCans?: any;
}

export function FeaturedCans({ menu, menus, lawrencevilleCans, zelienopleCans, isAuthenticated }: FeaturedCansProps) {
  const { currentLocation } = useLocationContext();

  // Build menus array from legacy props if menus prop not provided
  const menusArray = menus || [lawrencevilleCans, zelienopleCans].filter(Boolean);

  // Helper to convert Menu items to Can array
  const convertMenuToCans = (menuData: any) => {
    if (!menuData?.items) return [];

    const location = typeof menuData.location === 'object' ? menuData.location : null;
    const locationSlug = location?.slug;

    const cans = menuData.items
      .map((item: any) => {
        const beer = item.beer;
        if (!beer || !beer.slug) return null;

        // Map Payload beer structure to Can interface
        return {
          variant: beer.slug, // Map slug to variant
          name: beer.name,
          type: beer.style?.name || beer.style || '',
          abv: beer.abv?.toString() || '',
          image: !!beer.image,
          onDraft: false, // TODO: Check if also on draft
          glass: beer.glass,
          fourPack: beer.fourPack || item.price,
          recipe: beer.recipe || 0,
          _sourceLocationSlug: locationSlug, // Track which location this came from
        };
      })
      .filter(Boolean);

    // Find the highest recipe number
    const maxRecipe = Math.max(...cans.map((c: any) => c.recipe || 0));

    // Mark cans with the highest recipe number as "just released"
    return cans.map((can: any) => ({
      ...can,
      isJustReleased: can.recipe === maxRecipe && maxRecipe > 0,
    }));
  };

  // Convert menus to cans and filter by location
  const allCans = menusArray.flatMap(menuData => convertMenuToCans(menuData));

  // Filter cans by current location
  const filteredCans = React.useMemo(() => {
    if (currentLocation === 'all') {
      return allCans;
    }

    return allCans.filter(can => {
      // Use the location we stored during conversion
      const locationSlug = (can as any)._sourceLocationSlug;
      return locationSlug === currentLocation;
    });
  }, [currentLocation, allCans, menusArray]);

  // If menu provided (direct menu page), use its items; otherwise use filtered data
  const featuredCans = menu?.items ? convertMenuToCans(menu) : filteredCans;

  // Fullscreen menu mode
  if (menu) {
    return (
      <section className="h-full flex flex-col bg-background overflow-hidden">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex-1 flex flex-col py-8">
          <div className="text-center mb-6 flex-shrink-0">
            <h2 className="text-3xl lg:text-4xl font-bold">
              {menu?.name || 'Cans'}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-4">
            {featuredCans.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-y-14 gap-x-4 max-w-none" suppressHydrationWarning>
                {featuredCans.map((beer, index) => (
                  <div key={`${beer.variant}-${index}`} className="group flex-shrink-0" style={{ width: 'calc(20% - 16px)', minWidth: '180px', maxWidth: '220px' }}>
                    <div className="relative w-full" style={{ height: 'calc(45vh - 80px)', maxHeight: '380px' }}>
                      {beer.isJustReleased && (
                        <Badge variant="default" className="absolute top-2 left-1/2 -translate-x-1/2 -ml-[5px] text-xs z-10">
                          Just Released
                        </Badge>
                      )}
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
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none" style={{ marginLeft: '-11px', marginTop: 'calc(40px + 10em)' }}>
                        <h3 className="text-xl font-bold bg-background/95 px-3 py-2 rounded shadow-lg whitespace-nowrap">
                          {beer.name}{beer.fourPack && ` • $${beer.fourPack}/pack`}
                        </h3>
                        <Badge variant="outline" className="text-sm bg-background/95">
                          {beer.type}
                        </Badge>
                        {beer.onDraft && (() => {
                          const GlassIcon = getGlassIcon(beer.glass);
                          return (
                            <Badge variant="default" className="text-sm flex-shrink-0 flex items-center gap-1">
                              <GlassIcon className="h-4 w-4" />
                              Pouring
                            </Badge>
                          );
                        })()}
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
          <div className="flex items-center justify-center gap-4 mb-4">
            <h2 className="text-3xl lg:text-4xl font-bold">
              Cans
            </h2>
            {isAuthenticated && (
              <div className="flex gap-2">
                {menusArray.map((menuData) => {
                  if (!menuData?.id) return null;

                  const location = typeof menuData.location === 'object' ? menuData.location : null;
                  const locationSlug = location?.slug;
                  const locationName = location?.name;

                  if (!locationSlug) return null;

                  // Only show if current location matches or 'all' is selected
                  if (currentLocation !== 'all' && currentLocation !== locationSlug) {
                    return null;
                  }

                  return (
                    <Button key={menuData.id} asChild variant="outline" size="sm">
                      <a href={`/admin/collections/menus/${menuData.id}`} target="_blank" rel="noopener noreferrer">
                        <Pencil className="h-4 w-4 mr-1" />
                        {currentLocation === 'all' ? `Edit ${locationName}` : 'Edit'}
                      </a>
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mb-8">
          {featuredCans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" suppressHydrationWarning>
              {featuredCans.map((beer, index) => (
                <div key={`${beer.variant}-${index}`} className="group flex flex-col">
                  <div className="relative h-64 w-full flex-shrink-0 mb-4">
                    {beer.isJustReleased && (
                      <Badge variant="default" className="absolute top-2 left-1/2 -translate-x-1/2 -ml-[5px] text-xs z-10">
                        Just Released
                      </Badge>
                    )}
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
