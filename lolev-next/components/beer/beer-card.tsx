/**
 * Beer Card Component
 * Displays beer information in a card format for grid layouts
 */

'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Beer, GlassType } from '@/lib/types/beer';
import { Location } from '@/lib/types/location';
import { useLocationContext } from '@/components/location/location-provider';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface BeerCardProps {
  beer: Beer;
  showLocation?: boolean;
  showPricing?: boolean;
  showAvailability?: boolean;
  className?: string;
}

function getGlassIcon(glass: GlassType): string {
  switch (glass) {
    case GlassType.PINT:
      return '🍺';
    case GlassType.TEKU:
      return '🍷';
    case GlassType.STEIN:
      return '🍻';
    default:
      return '🍺';
  }
}

function getBeerImagePath(beer: Beer): string {
  if (!beer.image) {
    return '/images/beer/default-beer.webp';
  }
  return `/images/beer/${beer.variant}.webp`;
}

function formatAbv(abv: number): string {
  return `${abv.toFixed(1)}%`;
}

function getBeerSlug(beer: Beer): string {
  return beer.variant.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function getAvailabilityText(beer: Beer): string {
  const availability = [];

  if (beer.availability.tap) {
    availability.push(`Tap ${beer.availability.tap}`);
  }

  if (beer.availability.cansAvailable) {
    availability.push('Cans');
  }

  if (beer.availability.singleCanAvailable) {
    availability.push('Singles');
  }

  return availability.length > 0 ? availability.join(' • ') : 'Limited';
}

function getPricingText(beer: Beer): string {
  const pricing = [];

  if (beer.pricing.draftPrice) {
    pricing.push(`Draft $${beer.pricing.draftPrice}`);
  }

  if (beer.pricing.canSingle || beer.pricing.cansSingle) {
    const singlePrice = beer.pricing.canSingle || beer.pricing.cansSingle;
    pricing.push(`Single $${singlePrice}`);
  }

  if (beer.pricing.fourPack) {
    pricing.push(`4-Pack $${beer.pricing.fourPack}`);
  }

  return pricing.length > 0 ? pricing.join(' • ') : 'See store';
}

export function BeerCard({
  beer,
  showLocation = true,
  showPricing = true,
  showAvailability = true,
  className = '',
}: BeerCardProps) {
  const { currentLocation } = useLocationContext();
  const beerSlug = getBeerSlug(beer);
  const imagePath = getBeerImagePath(beer);

  // Don't show beer if it's hidden from site
  if (beer.availability.hideFromSite) {
    return null;
  }

  return (
    <Card className={`group hover:shadow-lg transition-shadow duration-200 ${className}`}>
      <CardHeader className="pb-4">
        <div className="relative aspect-square w-full mb-4 overflow-hidden rounded-lg bg-white dark:bg-black">
          <Image
            src={imagePath}
            alt={`${beer.name} beer`}
            fill
            className="object-cover transition-transform duration-200 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            loading="lazy"
          />
          {beer.glutenFree && (
            <Badge
              variant="secondary"
              className="absolute top-2 right-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
            >
              GF
            </Badge>
          )}
        </div>

        <CardTitle className="line-clamp-2 min-h-[2.5rem]">
          {beer.name}
        </CardTitle>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="font-medium">{beer.type}</span>
          <div className="flex items-center gap-1">
            <span>{getGlassIcon(beer.glass)}</span>
            <span>{formatAbv(beer.abv)} ABV</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
          {beer.description}
        </p>

        {beer.hops && (
          <div className="mb-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Hops:</p>
            <p className="text-sm">{beer.hops}</p>
          </div>
        )}

        <div className="space-y-2">
          {showAvailability && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Available:</span>
              <span className="font-medium">{getAvailabilityText(beer)}</span>
            </div>
          )}

          {showPricing && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pricing:</span>
              <span className="font-medium">{getPricingText(beer)}</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-4">
        <div className="w-full flex items-center justify-between">
          <div className="flex gap-2">
            {beer.availability.tap && (
              <Badge variant="default">
                On Tap
              </Badge>
            )}
            {beer.availability.cansAvailable && (
              <Badge variant="outline">
                Cans
              </Badge>
            )}
            {beer.pricing.salePrice && (
              <Badge variant="destructive">
                Sale
              </Badge>
            )}
          </div>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="ml-auto"
          >
            <Link
              href={showLocation ? `/${currentLocation}/beer/${beerSlug}` : `/beer/${beerSlug}`}
              className="no-underline"
            >
              Details
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default BeerCard;