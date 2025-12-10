'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getGlassIcon } from '@/lib/utils/beer-icons';
import { useLocationContext } from '@/components/location/location-provider';
import { DraftBeerCard } from '@/components/beer/draft-beer-card';
import { Pencil } from 'lucide-react';
import type { Menu, Style } from '@/src/payload-types';
import type { Beer } from '@/lib/types/beer';

type MenuType = 'draft' | 'cans';

interface MenuItem {
  variant: string;
  name: string;
  type: string;
  abv?: string;
  description: string;
  glutenFree: boolean;
  image?: boolean;
  onDraft?: boolean;
  glass?: string;
  fourPack?: string;
  isJustReleased?: boolean;
  recipe?: number;
  pricing: {
    draftPrice?: number;
  };
  availability: {
    hideFromSite?: boolean;
  };
  slug?: string;
  style?: string | Style;
  locationSlug?: string;
  [key: string]: unknown;
}

interface FeaturedMenuProps {
  menuType: MenuType;
  menu?: Menu;
  menus?: Menu[];
  isAuthenticated?: boolean;
}

// Shared logic to convert menu items
function convertMenuItems(menuData: Menu): MenuItem[] {
  if (!menuData?.items) return [];

  const location = typeof menuData.location === 'object' ? menuData.location : null;
  const locationSlug = location?.slug;

  const items = menuData.items
    .map((item) => {
      const beer = typeof item.beer === 'object' ? item.beer : null;
      if (!beer || !beer.slug) return null;

      const style = typeof beer.style === 'object' ? beer.style : null;

      return {
        variant: beer.slug,
        name: beer.name,
        type: style?.name || (typeof beer.style === 'string' ? beer.style : '') || '',
        abv: beer.abv?.toString() || '0',
        description: beer.description || '',
        glutenFree: false,
        image: !!beer.image,
        glass: beer.glass || 'pint',
        fourPack: beer.fourPack?.toString() || item.price || undefined,
        recipe: beer.recipe || 0,
        pricing: {
          draftPrice: item.price ? parseFloat(String(item.price).replace('$', '')) : undefined,
        },
        availability: {
          hideFromSite: beer.hideFromSite || false,
        },
        slug: beer.slug,
        style: beer.style,
        locationSlug: locationSlug || undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // Mark items with highest recipe number as "just released"
  const maxRecipe = Math.max(...items.map((i) => i.recipe || 0));
  return items.map((item) => ({
    ...item,
    isJustReleased: item.recipe === maxRecipe && maxRecipe > 0,
  }));
}

// Filter items by location based on the menu's location
function filterByLocation(items: MenuItem[], currentLocation: string): MenuItem[] {
  // If no location is selected or 'all', return all items
  if (!currentLocation || currentLocation === 'all') {
    return items;
  }
  // Filter to only items from the selected location
  return items.filter(item => item.locationSlug === currentLocation);
}

// Admin edit buttons component
function AdminEditButtons({
  menusArray,
  currentLocation,
  isAuthenticated
}: {
  menusArray: Menu[];
  currentLocation: string;
  isAuthenticated?: boolean;
}) {
  if (!isAuthenticated) return null;

  return (
    <div className="flex gap-2">
      {menusArray.map((menuData) => {
        if (!menuData?.id) return null;
        const location = typeof menuData.location === 'object' ? menuData.location : null;
        const locationSlug = location?.slug;
        const locationName = location?.name;
        if (!locationSlug) return null;
        if (currentLocation !== 'all' && currentLocation !== locationSlug) return null;

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
  );
}

// Can card component for cans display
function CanCard({ item, fullscreen = false }: { item: MenuItem; fullscreen?: boolean }) {
  const GlassIcon = getGlassIcon(item.glass);

  if (fullscreen) {
    return (
      <Link
        href={`/beer/${item.variant.toLowerCase()}`}
        className="group flex-shrink-0 cursor-pointer"
        style={{ width: 'calc(20% - 16px)', minWidth: '180px', maxWidth: '220px' }}
      >
        <div className="relative w-full transition-transform duration-200 group-hover:scale-[1.02]" style={{ height: 'calc(45vh - 80px)', maxHeight: '380px' }}>
          {item.image ? (
            <Image
              src={`/images/beer/${item.variant.toLowerCase()}.png`}
              alt={`${item.name} - ${item.type || 'Craft beer'} can`}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center px-4">
                <div className="text-2xl font-bold text-muted-foreground/30 mb-2">{item.name}</div>
                <div className="text-sm text-muted-foreground/30">{item.type}</div>
              </div>
            </div>
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none" style={{ marginLeft: '-11px', marginTop: 'calc(40px + 10em)' }}>
            {item.isJustReleased && (
              <Badge variant="default" className="text-xs mb-1">
                Just Released
              </Badge>
            )}
            <h3 className="text-xl font-bold bg-background/95 px-3 py-2 rounded shadow-lg whitespace-nowrap">
              {item.name}{item.fourPack && ` • $${item.fourPack}/pack`}
            </h3>
            <Badge variant="outline" className="text-sm bg-background/95">{item.type}</Badge>
            {item.onDraft && (
              <Badge variant="default" className="text-sm flex-shrink-0 flex items-center gap-1">
                <GlassIcon className="h-4 w-4" />
                Pouring
              </Badge>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/beer/${item.variant.toLowerCase()}`}
      className="group flex flex-col cursor-pointer"
    >
      <div className="relative h-64 w-full flex-shrink-0 mb-4 transition-transform duration-200 group-hover:scale-[1.02]">
        {item.image ? (
          <Image
            src={`/images/beer/${item.variant.toLowerCase()}.png`}
            alt={`${item.name} - ${item.type || 'Craft beer'} can`}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-4">
              <div className="text-2xl font-bold text-muted-foreground/30 mb-2">{item.name}</div>
              <div className="text-sm text-muted-foreground/30">{item.type}</div>
            </div>
          </div>
        )}
        {item.isJustReleased && (
          <Badge variant="default" className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-xs">
            Just Released
          </Badge>
        )}
      </div>
      <div className="mb-3">
        <div className="flex items-center justify-center gap-2 flex-wrap mb-2">
          <h3 className="text-lg font-semibold">{item.name}</h3>
          <Badge variant="outline" className="text-xs">{item.type}</Badge>
          {item.onDraft && (
            <Badge variant="default" className="text-xs flex-shrink-0 flex items-center gap-1">
              <GlassIcon className="h-3 w-3" />
              Pouring
            </Badge>
          )}
        </div>
      </div>
      <Button variant="outline" className="w-full group-hover:bg-muted/50" tabIndex={-1}>
        View Details
      </Button>
    </Link>
  );
}

export function FeaturedMenu({ menuType, menu, menus = [], isAuthenticated }: FeaturedMenuProps) {
  const { currentLocation } = useLocationContext();
  const title = menuType === 'draft' ? 'Draft' : 'Cans';
  const emptyMessage = menuType === 'draft'
    ? 'No beers on draft right now. Check back soon!'
    : 'No cans available. Check back soon for cans to take home.';

  // Convert and filter items
  const allItems = menus.flatMap(convertMenuItems);
  const filteredItems = React.useMemo(
    () => filterByLocation(allItems, currentLocation),
    [currentLocation, allItems]
  );
  const displayItems = menu?.items ? convertMenuItems(menu) : filteredItems;

  // Fullscreen menu mode (for /m/[menuUrl] pages)
  if (menu) {
    return (
      <section className="h-full flex flex-col bg-background overflow-hidden">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex-1 flex flex-col py-8">
          <div className="text-center mb-6 flex-shrink-0">
            <h2 className="text-3xl lg:text-4xl font-bold">{menu?.name || title}</h2>
          </div>
          <div className="flex-1 overflow-y-auto px-4">
            {displayItems.length > 0 ? (
              menuType === 'draft' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-none" suppressHydrationWarning>
                  {displayItems.map((item, index) => (
                    <DraftBeerCard key={`${item.variant}-${index}`} beer={item as unknown as Beer} showLocation={false} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-y-14 gap-x-4 max-w-none" suppressHydrationWarning>
                  {displayItems.map((item, index) => (
                    <CanCard key={`${item.variant}-${index}`} item={item} fullscreen />
                  ))}
                </div>
              )
            ) : (
              <div className="text-center py-12">
                <p className="text-xl font-semibold mb-2">No {menuType === 'draft' ? 'beers' : 'cans'} available</p>
                <p className="text-muted-foreground">{emptyMessage}</p>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Homepage section mode
  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1" />
            <h2 className="text-3xl lg:text-4xl font-bold">{title}</h2>
            <div className="flex-1 flex justify-end">
              <AdminEditButtons menusArray={menus} currentLocation={currentLocation} isAuthenticated={isAuthenticated} />
            </div>
          </div>
        </div>

        <div className="mb-8">
          {displayItems.length > 0 ? (
            menuType === 'draft' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" suppressHydrationWarning>
                {displayItems.map((item, index) => (
                  <DraftBeerCard key={`${item.variant}-${index}`} beer={item as unknown as Beer} showLocation={false} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" suppressHydrationWarning>
                {displayItems.map((item, index) => (
                  <CanCard key={`${item.variant}-${index}`} item={item} />
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">{menuType === 'draft' ? '🍺' : '🥫'}</div>
              <p className="text-xl font-semibold mb-2">No {menuType === 'draft' ? 'beers on draft' : 'cans available'}</p>
              <p className="text-muted-foreground">{emptyMessage}</p>
            </div>
          )}
        </div>

        <div className="text-center">
          <Button asChild variant="outline" size="lg">
            <Link href="/beer">View All Beer</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// Convenience exports for backward compatibility
export function FeaturedBeers(props: Omit<FeaturedMenuProps, 'menuType'>) {
  return <FeaturedMenu {...props} menuType="draft" />;
}

export function FeaturedCans(props: Omit<FeaturedMenuProps, 'menuType'>) {
  return <FeaturedMenu {...props} menuType="cans" />;
}
