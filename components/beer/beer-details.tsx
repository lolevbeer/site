/**
 * Beer Details Component
 * Displays comprehensive beer information for individual beer pages
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Beer } from '@/lib/types/beer';
import type { Menu, Beer as PayloadBeer } from '@/src/payload-types';
import { useLocationContext } from '@/components/location/location-provider';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import { CircleX } from 'lucide-react';
import { UntappdIcon } from '@/components/icons/untappd-icon';
import { AdminEditButton } from './admin-edit-button';
import { getGlassIcon } from '@/lib/utils/beer-icons';
import { formatAbv } from '@/lib/utils/formatters';
import { getBeerImageUrl } from '@/lib/utils/media-utils';
import { menuItemHasBeer } from '@/lib/utils/menu-item-utils';

interface BeerDetailsProps {
  beer: Beer;
  className?: string;
}

function getAvailabilityInfo(beer: Beer) {
  const { tap, cansAvailable, singleCanAvailable } = beer.availability ?? {};
  const isDraft = !!tap;
  const isCanned = !!(cansAvailable || singleCanAvailable);

  const details = [
    tap && `Pouring ${tap}`,
    cansAvailable && 'Cans available for purchase',
    singleCanAvailable && 'Single cans available',
  ].filter(Boolean) as string[];

  const status = isDraft && isCanned ? 'Pouring & Cans'
    : isDraft ? 'Pouring'
    : isCanned ? 'Cans Available'
    : 'Limited Availability';

  return { status, details, isDraft, isCanned };
}

function getPricingInfo(beer: Beer | (PayloadBeer & { pricing?: Beer['pricing']; salePrice?: boolean })): {
  draftPrice?: number;
  singlePrice?: number;
  fourPackPrice?: number;
  hasSale: boolean;
} {
  return {
    // Support both Payload structure (beer.draftPrice) and legacy structure (beer.pricing.draftPrice)
    draftPrice: 'draftPrice' in beer ? beer.draftPrice : beer.pricing?.draftPrice,
    singlePrice: ('canSingle' in beer ? beer.canSingle : undefined) ?? beer.pricing?.canSingle ?? beer.pricing?.cansSingle,
    fourPackPrice: ('fourPack' in beer ? beer.fourPack : undefined) ?? beer.pricing?.fourPack,
    hasSale: ('salePrice' in beer && beer.salePrice === true) || beer.pricing?.salePrice === true,
  };
}

function SpecificationRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-b-0">
      <span className="text-muted-foreground flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4" />}
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function BeerDetails({ beer, className = '' }: BeerDetailsProps) {
  const { currentLocation } = useLocationContext();
  const imagePath = getBeerImageUrl(beer.image, beer.variant);
  const _availability = getAvailabilityInfo(beer);
  const pricing = getPricingInfo(beer);
  const GlassIcon = getGlassIcon(beer.glass);
  const [tapLocations, setTapLocations] = useState<string[]>([]);
  const [canLocations, setCanLocations] = useState<string[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  useEffect(() => {
    // Don't fetch locations if beer ID is missing
    if (!beer.id) {
      setIsLoadingLocations(false);
      setTapLocations([]);
      setCanLocations([]);
      return;
    }

    const fetchLocations = async () => {
      setIsLoadingLocations(true);
      setLocationError(null);

      try {
        // Query Payload CMS for all published menus (we'll filter client-side for the beer)
        const response = await fetch(
          `/api/menus?where[_status][equals]=published&depth=2&limit=100`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch menus');
        }

        const data = await response.json();
        const tapLocs: string[] = [];
        const canLocs: string[] = [];

        // Process menus to extract location availability
        if (data.docs && Array.isArray(data.docs)) {
          data.docs.forEach((menu: Menu) => {
            // Check if this beer is in the menu items
            const hasBeer = beer.id && menu.items?.some((item) => menuItemHasBeer(item, beer.id!));

            if (hasBeer && menu.location) {
              const locationName = typeof menu.location === 'string'
                ? menu.location
                : menu.location?.name;

              if (locationName) {
                if (menu.type === 'draft' && !tapLocs.includes(locationName)) {
                  tapLocs.push(locationName);
                } else if (menu.type === 'cans' && !canLocs.includes(locationName)) {
                  canLocs.push(locationName);
                }
              }
            }
          });
        }

        setTapLocations(tapLocs);
        setCanLocations(canLocs);
      } catch (error) {
        console.error('Error fetching beer location data:', error);
        setLocationError('Unable to load location information. Please try again later.');
      } finally {
        setIsLoadingLocations(false);
      }
    };

    fetchLocations();
  }, [beer.id]);

  // Don't render if beer is hidden from site
  if (beer.availability?.hideFromSite) {
    return (
      <Empty className={className}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CircleX className="h-6 w-6" />
          </EmptyMedia>
          <EmptyTitle>Beer Not Available</EmptyTitle>
          <EmptyDescription>
            This beer is currently not available on our website.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href={`/${currentLocation}/beer`}>
              Browse Available Beers
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className={className}>
      {/* Breadcrumbs */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/beer">Beer</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{beer.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8 mb-8">
        {/* Beer Image and Quick Stats */}
        <div className="space-y-4">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-gradient-to-b from-muted/30 to-muted/10 dark:from-muted/10 dark:to-muted/5">
            {imagePath && !imageError ? (
              <Image
                src={imagePath}
                alt={`${beer.name} beer`}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 800px"
                priority
                onError={handleImageError}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-center px-4">
                <p className="text-lg font-semibold text-muted-foreground/70">{beer.name}</p>
                {beer.type && (
                  <p className="text-sm text-muted-foreground/50 mt-1">{beer.type}</p>
                )}
              </div>
            )}
            {beer.glutenFree && (
              <Badge
                variant="secondary"
                className="absolute top-4 right-4 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
              >
                Gluten Free
              </Badge>
            )}
            {pricing.hasSale && (
              <Badge
                variant="destructive"
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-lg px-4 py-2"
              >
                Just Released
              </Badge>
            )}
          </div>

          {/* Quick Stats */}
          <Card className="shadow-none border-0 p-0 bg-transparent">
            <CardContent className="p-0 space-y-0">
              <SpecificationRow
                label="Style"
                value={beer.type}
              />
              <SpecificationRow
                label="Alc by Vol"
                value={formatAbv(beer.abv)}
              />
              {beer.recipe && (
                <SpecificationRow
                  label="Recipe #"
                  value={beer.recipe}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Beer Information */}
        <div className="space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="text-3xl font-bold">{beer.name}</h1>
              {beer.id && <AdminEditButton beerId={beer.id} />}
            </div>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {tapLocations.length > 0 && (
                <Badge variant="default" className="text-sm flex items-center gap-1">
                  <GlassIcon className="h-3.5 w-3.5" />
                  On Draft
                </Badge>
              )}
              {canLocations.length > 0 && (
                <Badge variant="default" className="text-sm">
                  Cans Available
                </Badge>
              )}
              {!isLoadingLocations && tapLocations.length > 0 && canLocations.length === 0 && (
                <Badge variant="outline" className="text-sm text-muted-foreground border-muted-foreground/50">
                  No Cans
                </Badge>
              )}
              {pricing.hasSale && (
                <Badge variant="destructive" className="text-sm">
                  Sale
                </Badge>
              )}
            </div>
            {beer.options && (
              <p className="text-muted-foreground mb-4">{beer.options}</p>
            )}
          </div>

          {/* Description */}
          {beer.description && (
            <div>
              <h2 className="text-xl font-semibold mb-3">Description</h2>
              <p>
                {beer.description}
              </p>
            </div>
          )}

          {/* Hops */}
          {beer.hops && (
            <div>
              <h2 className="text-xl font-semibold mb-3">Hops</h2>
              <p>{beer.hops}</p>
            </div>
          )}

          {/* Availability and Pricing */}
          <div className="space-y-6">
            {/* Availability */}
            <Card className="shadow-none border-0 p-0 bg-transparent">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg">Availability</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingLocations ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-4 bg-muted rounded w-2/3"></div>
                  </div>
                ) : locationError ? (
                  <p className="text-sm text-destructive">{locationError}</p>
                ) : (
                  <div className="space-y-2">
                    {tapLocations.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        • On draft at {tapLocations.join(' and ')}
                      </p>
                    )}
                    {canLocations.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        • Cans available at {canLocations.join(' and ')}
                      </p>
                    )}
                    {tapLocations.length > 0 && canLocations.length === 0 && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                        • No cans available at this time — draft only
                      </p>
                    )}
                    {tapLocations.length === 0 && canLocations.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Not currently available in Lawrenceville or Zelienople
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pricing */}
            {((tapLocations.length > 0 && pricing.draftPrice) || (canLocations.length > 0 && pricing.fourPackPrice)) && (
              <Card className="shadow-none border-0 p-0 bg-transparent">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    Pricing
                    {pricing.hasSale && (
                      <Badge variant="destructive" className="text-xs">
                        Sale Price
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="space-y-2">
                    {tapLocations.length > 0 && pricing.draftPrice && (
                      <p className="text-sm text-muted-foreground">
                        • Draft ${pricing.draftPrice}
                      </p>
                    )}
                    {canLocations.length > 0 && pricing.fourPackPrice && (
                      <p className="text-sm text-muted-foreground">
                        • 4 Pack ${pricing.fourPackPrice}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* External Links */}
          {beer.untappd && (
            <div>
              <Button variant="ghost" asChild>
                <a
                  href={`https://untappd.com/b/-/${beer.untappd}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-underline"
                >
                  <>
                    <UntappdIcon className="h-5 w-5" />
                    Untappd
                  </>
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BeerDetails;