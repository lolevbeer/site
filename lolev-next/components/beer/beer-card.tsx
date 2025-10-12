/**
 * Beer Card Component
 * Refactored to use BaseCard and shared utilities
 */

'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Beer, GlassType } from '@/lib/types/beer';
import { useLocationContext } from '@/components/location/location-provider';
import { BaseCard, CardSkeleton } from '@/components/ui/base-card';
import { StatusBadge, StatusBadgeGroup } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Beer as BeerIcon, Wine, GlassWater } from 'lucide-react';
import {
  formatAbv,
  getBeerSlug,
  getBeerAvailability,
  getBeerPricing
} from '@/lib/utils/formatters';

interface BeerCardProps {
  beer: Beer;
  showLocation?: boolean;
  showPricing?: boolean;
  showAvailability?: boolean;
  className?: string;
  variant?: 'default' | 'compact';
}

function getGlassIcon(glass: GlassType): React.ComponentType<{ className?: string }> {
  switch (glass) {
    case GlassType.PINT:
      return BeerIcon;
    case GlassType.TEKU:
      return Wine;
    case GlassType.STEIN:
      return GlassWater;
    default:
      return BeerIcon;
  }
}

function getBeerImagePath(beer: Beer): string | null {
  if (!beer.image) {
    return null;
  }
  return `/images/beer/${beer.variant}.webp`;
}

export function BeerCard({
  beer,
  showLocation = true,
  showPricing = true,
  showAvailability = true,
  className = '',
  variant = 'default'
}: BeerCardProps) {
  const { currentLocation } = useLocationContext();
  const beerSlug = getBeerSlug(beer);
  const imagePath = getBeerImagePath(beer);

  // Don't show beer if it's hidden from site
  if (beer.availability.hideFromSite) {
    return null;
  }

  const renderHeader = (beer: Beer) => (
    <>
      <div className="relative aspect-square w-full mb-4 overflow-hidden rounded-lg">
        {imagePath ? (
          <Image
            src={imagePath}
            alt={`${beer.name} beer`}
            fill
            className="object-contain transition-transform duration-200 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <span className="text-gray-400 dark:text-gray-500 font-medium">No Image</span>
          </div>
        )}
        {beer.glutenFree && (
          <div className="absolute top-2 right-2">
            <StatusBadge status="gluten_free" type="beer" size="sm" />
          </div>
        )}
      </div>
      <div>
        <h3 className="font-semibold text-lg line-clamp-2 min-h-[2.5rem]">
          {beer.name}
        </h3>
        <div className="flex items-center justify-between text-sm text-muted-foreground mt-1">
          <span className="font-medium">{beer.type}</span>
          <div className="flex items-center gap-1">
            {React.createElement(getGlassIcon(beer.glass), { className: "h-4 w-4" })}
            <span>{formatAbv(beer.abv)} ABV</span>
          </div>
        </div>
      </div>
    </>
  );

  const renderContent = (beer: Beer) => (
    <>
      <p className="text-sm text-muted-foreground line-clamp-3">
        {beer.description}
      </p>

      {beer.hops && variant !== 'compact' && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Hops:</p>
          <p className="text-sm">{beer.hops}</p>
        </div>
      )}

      {variant !== 'compact' && (
        <div className="space-y-2">
          {showAvailability && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Available:</span>
              <span className="font-medium">{getBeerAvailability(beer)}</span>
            </div>
          )}

          {showPricing && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pricing:</span>
              <span className="font-medium">{getBeerPricing(beer)}</span>
            </div>
          )}
        </div>
      )}
    </>
  );

  const renderFooter = (beer: Beer) => (
    <div className="w-full flex items-center justify-between pt-4 border-t">
      <StatusBadgeGroup
        statuses={[
          ...(beer.availability.cansAvailable ? [{ status: 'cans', type: 'beer' as const }] : []),
          ...(beer.availability.tap ? [{ status: 'on_tap', type: 'beer' as const, customLabel: `Tap ${beer.availability.tap}` }] : []),
          ...(beer.pricing.salePrice ? [{ status: 'sale', type: 'beer' as const }] : [])
        ]}
        size="sm"
      />

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
  );

  return (
    <BaseCard
      item={beer}
      variant={variant}
      className={`group ${className}`}
      renderHeader={renderHeader}
      renderContent={renderContent}
      renderFooter={renderFooter}
    />
  );
}

export function BeerCardSkeleton({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  return <CardSkeleton variant={variant} lines={4} />;
}

export default BeerCard;