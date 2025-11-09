'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { DraftBeerCard } from '@/components/beer/draft-beer-card';
import type { Beer } from '@/lib/types/beer';
import Link from 'next/link';
import { useLocationFilteredData } from '@/lib/hooks/use-location-filtered-data';
import { useLocationContext } from '@/components/location/location-provider';
import { Pencil } from 'lucide-react';

interface FeaturedBeersProps {
  menu?: any; // Menu from Payload with items (beers) - for fullscreen mode
  menus?: any[]; // Array of menus from different locations
  isAuthenticated?: boolean; // Whether user is authenticated
  // Legacy props for backward compatibility
  lawrencevilleBeers?: any;
  zelienopleBeers?: any;
}

export function FeaturedBeers({ menu, menus, lawrencevilleBeers, zelienopleBeers, isAuthenticated }: FeaturedBeersProps) {
  const { currentLocation } = useLocationContext();

  // Build menus array from legacy props if menus prop not provided
  const menusArray = menus || [lawrencevilleBeers, zelienopleBeers].filter(Boolean);

  // Helper to convert Menu items to Beer array
  const convertMenuToBeers = (menuData: any) => {
    if (!menuData?.items) return [];

    console.log(`🔧 convertMenuToBeers: processing ${menuData.items.length} items from menu ${menuData.id}`);

    const location = typeof menuData.location === 'object' ? menuData.location : null;
    const locationSlug = location?.slug;

    const beers = menuData.items
      .map((item: any, index: number) => {
        const beer = item.beer;
        if (!beer || !beer.slug) {
          console.log(`⚠️ Item ${index}: Skipping - beer is ${typeof beer} or missing slug`);
          return null;
        }

        // Map Payload beer structure to expected Beer interface
        return {
          ...beer,
          variant: beer.slug, // Map slug to variant for compatibility
          type: beer.style?.name || beer.style || '',
          glass: beer.glass || 'pint',
          pricing: {
            draftPrice: item.price ? parseFloat(item.price.replace('$', '')) : undefined,
          },
          availability: {
            hideFromSite: beer.hideFromSite || false,
          },
          recipe: beer.recipe || 0,
          _sourceLocationSlug: locationSlug, // Track which location this came from
        };
      })
      .filter(Boolean);

    // Find the highest recipe number
    const maxRecipe = Math.max(...beers.map((b: any) => b.recipe || 0));

    // Mark beers with the highest recipe number as "just released"
    return beers.map((beer: any) => ({
      ...beer,
      isJustReleased: beer.recipe === maxRecipe && maxRecipe > 0,
    }));
  };

  // Convert menus to beers and filter by location
  const allBeers = menusArray.flatMap(menuData => {
    const beers = convertMenuToBeers(menuData);
    console.log(`🔍 Converting menu ${menuData?.id} - got ${beers.length} beers`);
    return beers;
  });

  console.log(`📊 Total beers before filtering: ${allBeers.length}`);

  // Filter beers by current location
  const filteredBeers = React.useMemo(() => {
    console.log(`🔍 Filtering beers for location: "${currentLocation}"`);

    if (currentLocation === 'all') {
      console.log(`✅ Showing all ${allBeers.length} beers (location is "all")`);
      return allBeers;
    }

    const result = allBeers.filter(beer => {
      // Use the location we stored during conversion
      const locationSlug = (beer as any)._sourceLocationSlug;

      if (!locationSlug) {
        console.log(`❌ Beer ${(beer as any).name} - no source location found`);
        return false;
      }

      const matches = locationSlug === currentLocation;

      console.log(`${matches ? '✅' : '❌'} Beer ${(beer as any).name} - location: ${locationSlug}, matches: ${matches}`);

      return matches;
    });

    console.log(`✅ Filtered beers for location "${currentLocation}": ${result.length} out of ${allBeers.length}`);
    return result;
  }, [currentLocation, allBeers, menusArray]);

  // If menu provided (direct menu page), use its items; otherwise use filtered data
  const featuredBeers = menu?.items ? convertMenuToBeers(menu) : filteredBeers;

  // Fullscreen menu mode
  if (menu) {
    return (
      <section className="h-full flex flex-col bg-background overflow-hidden">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex-1 flex flex-col py-8">
          <div className="text-center mb-6 flex-shrink-0">
            <h2 className="text-3xl lg:text-4xl font-bold">
              {menu?.name || 'Draft'}
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
          <div className="flex items-center justify-center gap-4 mb-4">
            <h2 className="text-3xl lg:text-4xl font-bold">
              Draft
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
