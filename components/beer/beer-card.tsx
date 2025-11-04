/**
 * Beer Card Component
 * Refactored to use BaseCard and shared utilities
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { Beer, GlassType } from '@/lib/types/beer';
import { useLocationContext } from '@/components/location/location-provider';
import { BaseCard, CardSkeleton } from '@/components/ui/base-card';
import { StatusBadge, StatusBadgeGroup } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Beer as BeerIcon, Wine, GlassWater, MapPin } from 'lucide-react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { BeerImage } from './beer-image';
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
  variant?: 'full' | 'compact' | 'minimal';
  showInlineBadges?: boolean;
  priority?: boolean;
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

export const BeerCard = React.memo(function BeerCard({
  beer,
  showLocation = true,
  showPricing = true,
  showAvailability = true,
  className = '',
  variant = 'full',
  showInlineBadges = false,
  priority = false
}: BeerCardProps) {
  const { currentLocation } = useLocationContext();
  const beerSlug = getBeerSlug(beer);

  // Don't show beer if it's hidden from site
  if (beer.availability.hideFromSite) {
    return null;
  }

  // Minimal variant uses simple card structure without BaseCard
  if (variant === 'minimal') {
    return (
      <Link href={showLocation ? `/${currentLocation}/beer/${beerSlug}` : `/beer/${beerSlug}`} className="group">
        <div className={`overflow-hidden hover:shadow-lg transition-shadow flex flex-col border-0 h-full cursor-pointer bg-[var(--color-card-interactive)] rounded-lg ${className}`}>
          <BeerImage
            beer={beer}
            className="relative h-48 w-full flex-shrink-0"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            priority={priority}
          />
          <div className="p-4 flex flex-col flex-grow">
            <div className="flex-grow">
              <div className="flex items-start justify-between mb-2 gap-2">
                <h3 className="text-lg font-semibold">{beer.name}</h3>
                {showInlineBadges && (
                  <div className="flex gap-1 flex-shrink-0 items-center">
                    {beer.availability.cansAvailable && (
                      <span className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-2 py-1 text-xs font-medium whitespace-nowrap">
                        Cans
                      </span>
                    )}
                    {beer.availability.tap && (
                      <span className="inline-flex items-center rounded-md bg-secondary text-secondary-foreground px-2 py-1 text-xs font-medium whitespace-nowrap">
                        Tap {beer.availability.tap}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>{beer.type}</div>
                <div>{formatAbv(beer.abv)} ABV</div>
              </div>

              {/* Location badges - show where beer is available */}
              {!showLocation && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {beer.availability.tap && (
                    <HoverCard openDelay={200}>
                      <HoverCardTrigger asChild>
                        <Badge variant="secondary" className="text-xs cursor-help">
                          <MapPin className="h-3 w-3 mr-1" />
                          On Tap
                        </Badge>
                      </HoverCardTrigger>
                      <HoverCardContent side="top" className="w-auto p-2">
                        <p className="text-xs">Available at {currentLocation === 'all' ? 'selected location' : currentLocation === 'lawrenceville' ? 'Lawrenceville' : 'Zelienople'}</p>
                      </HoverCardContent>
                    </HoverCard>
                  )}
                  {beer.availability.cansAvailable && (
                    <Badge variant="outline" className="text-xs">
                      Cans Available
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <div className="mt-3">
              <Button variant="ghost" size="sm" className="w-full pointer-events-none">
                View Details
              </Button>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  const renderHeader = (beer: Beer) => (
    <>
      <BeerImage
        beer={beer}
        className="aspect-square w-full mb-4 rounded-lg"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        priority={priority}
      />
      {beer.glutenFree && (
        <div className="absolute top-2 right-2 z-10">
          <StatusBadge status="gluten_free" type="beer" size="sm" />
        </div>
      )}
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

      {beer.hops && variant === 'full' && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Hops:</p>
          <p className="text-sm">{beer.hops}</p>
        </div>
      )}

      {variant === 'full' && (
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

  // Map our variants to BaseCard variants
  const baseCardVariant = variant === 'full' ? 'detailed' : variant;

  return (
    <BaseCard
      item={beer}
      variant={baseCardVariant}
      className={`group ${className}`}
      renderHeader={renderHeader}
      renderContent={renderContent}
      renderFooter={renderFooter}
    />
  );
});

export const BeerCardSkeleton = React.memo(function BeerCardSkeleton({
  variant = 'full'
}: {
  variant?: 'full' | 'compact' | 'minimal'
}) {
  if (variant === 'minimal') {
    return (
      <div className="overflow-hidden rounded-lg bg-card border animate-pulse">
        <div className="relative h-48 w-full bg-muted" />
        <div className="p-4 space-y-3">
          <div className="h-5 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-8 bg-muted rounded w-full" />
        </div>
      </div>
    );
  }
  // Map our variants to BaseCard skeleton variants
  const baseCardVariant = variant === 'full' ? 'detailed' : variant;
  return <CardSkeleton variant={baseCardVariant} lines={4} />;
});

export default BeerCard;