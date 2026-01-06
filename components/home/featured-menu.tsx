'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { Beer as BeerIconLucide, Package } from 'lucide-react';
import { getGlassIcon } from '@/lib/utils/beer-icons';
import { useLocationContext } from '@/components/location/location-provider';
import { DraftBeerCard } from '@/components/beer/draft-beer-card';
import { Pencil } from 'lucide-react';
import { useAnimatedList, getAnimationClass } from '@/lib/hooks/use-animated-list';
import { getMediaUrl } from '@/lib/utils/media-utils';
import { extractBeerFromMenuItem, extractProductFromMenuItem } from '@/lib/utils/menu-item-utils';
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
  /** Image URL from Payload CMS Media, or undefined if no image */
  imageUrl?: string;
  onDraft?: boolean;
  glass?: string;
  fourPack?: string;
  isJustReleased?: boolean;
  recipe?: number;
  hops?: string;
  tap?: number;
  pricing: {
    draftPrice?: number;
    halfPour?: number;
    halfPourOnly?: boolean;
  };
  availability: {
    hideFromSite?: boolean;
  };
  slug?: string;
  style?: string | Style;
  locationSlug?: string;
  /** Manual "Just Released" flag from Payload */
  justReleased?: boolean;
  /** Beer creation date for auto "Just Released" logic */
  createdAt?: string;
  [key: string]: unknown;
}

interface FeaturedMenuProps {
  menuType: MenuType;
  menu?: Menu;
  menus?: Menu[];
  isAuthenticated?: boolean;
  /** Enable enter/exit animations for live updates */
  animated?: boolean;
}

// Check if a date is within the last N days
function isWithinDays(dateStr: string | undefined, days: number): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

// Shared logic to convert menu items
function convertMenuItems(menuData: Menu): MenuItem[] {
  if (!menuData?.items) return [];

  const location = typeof menuData.location === 'object' ? menuData.location : null;
  const locationSlug = location?.slug;

  const items = menuData.items
    .map((item, index) => {
      // Try to extract beer first
      const beer = extractBeerFromMenuItem(item);

      // If not a beer, check if it's a product
      if (!beer) {
        const prod = extractProductFromMenuItem(item);
        if (prod) {
          return {
            variant: String(prod.id || `product-${index}`),
            name: String(prod.name || 'Unknown Product'),
            type: Array.isArray(prod.options) ? prod.options.join(', ') : String(prod.options || ''),
            abv: prod.abv ? String(prod.abv) : '',
            description: '',
            glutenFree: false,
            imageUrl: undefined,
            glass: 'pint',
            fourPack: String(prod.price || item.price || ''),
            recipe: 0,
            hops: undefined,
            tap: index + 1,
            pricing: {
              draftPrice: item.price
                ? parseFloat(String(item.price).replace('$', ''))
                : prod.price
                  ? parseFloat(String(prod.price).replace('$', ''))
                  : undefined,
            },
            availability: {
              hideFromSite: false,
            },
            slug: String(prod.id || `product-${index}`),
            style: undefined,
            locationSlug: locationSlug ? String(locationSlug) : undefined,
            justReleased: false,
            createdAt: prod.createdAt,
          };
        }
        return null;
      }

      if (!beer.slug) return null;

      const style = typeof beer.style === 'object' ? beer.style : null;
      const styleName = style?.name || (typeof beer.style === 'string' ? beer.style : '');

      return {
        variant: String(beer.slug),
        name: String(beer.name || ''),
        type: String(styleName || ''),
        abv: beer.abv ? String(beer.abv) : '0',
        description: String(beer.description || ''),
        glutenFree: false,
        imageUrl: getMediaUrl(beer.image),
        glass: String(beer.glass || 'pint'),
        fourPack: beer.fourPack ? String(beer.fourPack) : (item.price ? String(item.price) : undefined),
        recipe: beer.recipe || 0,
        hops: beer.hops ? String(beer.hops) : undefined,
        tap: index + 1, // 1-based tap/draft number from position in menu
        pricing: {
          draftPrice: item.price
            ? parseFloat(String(item.price).replace('$', ''))
            : beer.draftPrice,
          halfPour: beer.halfPour ?? undefined,
          halfPourOnly: beer.halfPourOnly || false,
        },
        availability: {
          hideFromSite: beer.hideFromSite || false,
        },
        slug: String(beer.slug),
        style: styleName, // Pass as string, not object
        locationSlug: locationSlug ? String(locationSlug) : undefined,
        // Store these for "just released" logic
        justReleased: (beer as { justReleased?: boolean }).justReleased || false,
        createdAt: beer.createdAt,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // "Just Released" logic:
  // 1. If any beer has justReleased manually set, only mark those
  // 2. Otherwise, mark beers created within the last 2 weeks
  const hasManualJustReleased = items.some((i) => i.justReleased);

  return items.map((item) => ({
    ...item,
    isJustReleased: hasManualJustReleased
      ? item.justReleased
      : isWithinDays(item.createdAt, 14),
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

  // Shared image rendering logic
  const renderImage = (heightClass?: string) => {
    if (item.imageUrl) {
      return (
        <Image
          src={item.imageUrl}
          alt={`${item.name} - ${item.type || 'Craft beer'} can`}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        />
      );
    }
    return (
      <div className={`flex items-center justify-center ${heightClass || 'h-full'}`}>
        <div className="text-center px-4">
          <div className="text-2xl font-bold text-muted-foreground/30 mb-2">{item.name}</div>
          <div className="text-sm text-muted-foreground/30">{item.type}</div>
        </div>
      </div>
    );
  };

  if (fullscreen) {
    return (
      <Link
        href={`/beer/${item.variant.toLowerCase()}`}
        className="group cursor-pointer flex flex-col"
      >
        <div className="relative w-full transition-transform duration-200 group-hover:scale-[1.02]" style={{ height: '28vh' }}>
          {renderImage()}
          {item.isJustReleased && (
            <Badge variant="default" className="absolute left-1/2 -translate-x-1/2" style={{ bottom: '-0.8vh', fontSize: '1.3vh' }}>
              Just Released
            </Badge>
          )}
        </div>
        <div className="flex flex-col items-center text-center" style={{ gap: '0.5vh', marginTop: '1.5vh' }}>
          <h3 className="font-bold leading-tight" style={{ fontSize: '2vh' }}>
            {item.name}
          </h3>
          <Badge variant="outline" style={{ fontSize: '1.3vh' }}>{item.type}</Badge>
          {item.fourPack && (
            <span className="font-semibold" style={{ fontSize: '1.8vh' }}>
              ${item.fourPack} <span className="font-normal text-foreground/70" style={{ fontSize: '1.4vh' }}>• Four Pack</span>
            </span>
          )}
          {item.onDraft && (
            <Badge variant="default" className="flex items-center" style={{ fontSize: '1.3vh', gap: '0.3vh' }}>
              <div style={{ height: '1.5vh', width: '1.5vh' }}>
                <GlassIcon className="w-full h-full" />
              </div>
              Pouring
            </Badge>
          )}
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
        {renderImage()}
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

export function FeaturedMenu({ menuType, menu, menus = [], isAuthenticated, animated = false }: FeaturedMenuProps) {
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

  // Animated items for live updates (only when animated prop is true)
  const animatedItems = useAnimatedList(displayItems, {
    getKey: (item) => item.variant,
    exitDuration: 500,
  });

  // Fullscreen menu mode (for /m/[menuUrl] pages)
  if (menu) {
    // Use animated items when animations are enabled
    const itemsToRender = animated ? animatedItems : displayItems.map(item => ({ item, state: 'stable' as const, key: item.variant }));

    return (
      <section className="h-full flex flex-col bg-background overflow-hidden">
        <div className="w-full flex-1 flex flex-col" style={{ padding: '2vh 2vw 0.5vh 2vw' }}>
          <div className="text-center flex-shrink-0" style={{ marginBottom: '2vh' }}>
            <h2 className="font-bold" style={{ fontSize: '4vh' }}>{menu?.name || title}</h2>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ padding: '0 1vw' }}>
            {itemsToRender.length > 0 ? (
              menuType === 'draft' ? (
                // Split items into two columns: 1-6 left, 7-12 right (column-first ordering)
                (() => {
                  const midpoint = Math.ceil(itemsToRender.length / 2);
                  const leftColumn = itemsToRender.slice(0, midpoint);
                  const rightColumn = itemsToRender.slice(midpoint);

                  // Column header component with viewport-relative sizing
                  const isOtherMenu = menu?.type === 'other';
                  const ColumnHeader = () => (
                    <div
                      className="flex items-center border-b-2 border-border uppercase tracking-wider text-foreground font-bold"
                      style={{ gap: '1.5vh', padding: '0.5vh 1vh', marginBottom: '0.5vh', fontSize: '1.2vh' }}
                    >
                      {!isOtherMenu && <div style={{ minWidth: '7vh' }}>Tap</div>}
                      <div className="flex-grow">{isOtherMenu ? 'Item' : 'Beer'}</div>
                      <div className="flex" style={{ gap: '2vh' }}>
                        {!isOtherMenu && <div className="text-center" style={{ minWidth: '5vh' }}>ABV</div>}
                        <div className="text-center" style={{ minWidth: '6vh' }}>Half</div>
                        <div className="text-center" style={{ minWidth: '6vh' }}>Full</div>
                      </div>
                    </div>
                  );

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] max-w-none h-full" style={{ gap: '2vw' }} suppressHydrationWarning>
                      <div className="flex flex-col h-full min-w-0">
                        <ColumnHeader />
                        <div className="flex flex-col flex-1 min-w-0">
                          {leftColumn.map(({ item, state, key }) => (
                            <div key={key} className={`flex-1 min-w-0 ${animated ? getAnimationClass(state) : ''}`}>
                              <DraftBeerCard beer={item as unknown as Beer} showLocation={false} showTapAndPrice showGlass={!isOtherMenu} showTap={!isOtherMenu} showAbv={!isOtherMenu} showJustReleased={!isOtherMenu} />
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Vertical divider */}
                      <div className="hidden md:block w-0.5 bg-border" />
                      <div className="flex flex-col h-full min-w-0">
                        <ColumnHeader />
                        <div className="flex flex-col flex-1 min-w-0">
                          {rightColumn.map(({ item, state, key }) => (
                            <div key={key} className={`flex-1 min-w-0 ${animated ? getAnimationClass(state) : ''}`}>
                              <DraftBeerCard beer={item as unknown as Beer} showLocation={false} showTapAndPrice showGlass={!isOtherMenu} showTap={!isOtherMenu} showAbv={!isOtherMenu} showJustReleased={!isOtherMenu} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="grid gap-x-4 max-w-none" style={{ gridTemplateColumns: `repeat(${Math.ceil(itemsToRender.length / 2)}, 1fr)`, rowGap: '4vh' }} suppressHydrationWarning>
                  {itemsToRender.map(({ item, state, key }) => (
                    <div key={key} className={animated ? getAnimationClass(state) : ''}>
                      <CanCard item={item} fullscreen />
                    </div>
                  ))}
                </div>
              )
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    {menuType === 'draft' ? <BeerIconLucide className="h-6 w-6" /> : <Package className="h-6 w-6" />}
                  </EmptyMedia>
                  <EmptyTitle>No {menuType === 'draft' ? 'beers' : 'cans'} available</EmptyTitle>
                  <EmptyDescription>{emptyMessage}</EmptyDescription>
                </EmptyHeader>
              </Empty>
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
        <ScrollReveal>
          <div className="text-center mb-12">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1" />
              <h2 className="text-3xl lg:text-4xl font-bold">{title}</h2>
              <div className="flex-1 flex justify-end">
                <AdminEditButtons menusArray={menus} currentLocation={currentLocation} isAuthenticated={isAuthenticated} />
              </div>
            </div>
          </div>
        </ScrollReveal>

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
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {menuType === 'draft' ? <BeerIconLucide className="h-6 w-6" /> : <Package className="h-6 w-6" />}
                </EmptyMedia>
                <EmptyTitle>No {menuType === 'draft' ? 'beers on draft' : 'cans available'}</EmptyTitle>
                <EmptyDescription>{emptyMessage}</EmptyDescription>
              </EmptyHeader>
            </Empty>
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
  return <FeaturedMenu {...props} menuType="draft" animated={props.animated} />;
}

export function FeaturedCans(props: Omit<FeaturedMenuProps, 'menuType'>) {
  return <FeaturedMenu {...props} menuType="cans" animated={props.animated} />;
}
