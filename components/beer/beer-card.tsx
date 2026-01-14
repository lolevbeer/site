/**
 * Beer Card Component
 * Refactored to use BaseCard and shared utilities
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { Beer } from '@/lib/types/beer';
import { useLocationContext } from '@/components/location/location-provider';
import { BaseCard, CardSkeleton } from '@/components/ui/base-card';
import { StatusBadge, StatusBadgeGroup } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { getGlassIcon } from '@/lib/utils/beer-icons';
import { trackBeerView } from '@/lib/analytics/events';

interface BeerCardProps {
  beer: Beer;
  showLocation?: boolean;
  showPricing?: boolean;
  showAvailability?: boolean;
  className?: string;
  variant?: 'full' | 'minimal';
  priority?: boolean;
}

export const BeerCard = React.memo(function BeerCard({
  beer,
  showLocation = true,
  showPricing = true,
  showAvailability = true,
  className = '',
  variant = 'full',
  priority = false
}: BeerCardProps) {
  const { currentLocation } = useLocationContext();
  const beerSlug = getBeerSlug(beer);

  // Don't show beer if it's hidden from site
  if (beer.availability.hideFromSite) {
    return null;
  }

  // Minimal variant uses simple card structure without BaseCard - matches homepage cans style
  if (variant === 'minimal') {
    const GlassIcon = getGlassIcon(beer.glass);
    const beerHref = showLocation ? `/${currentLocation}/beer/${beerSlug}` : `/beer/${beerSlug}`;

    return (
      <Link
        href={beerHref}
        onClick={() => trackBeerView(beer.name, beer.type)}
        className="group flex flex-col cursor-pointer transition-transform duration-200 hover:-translate-y-1"
      >
        <div className="relative h-64 w-full flex-shrink-0 mb-4 transition-transform duration-200 group-hover:scale-[1.02]">
          <BeerImage
            beer={beer}
            className="w-full h-full"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            priority={priority}
          />
        </div>
        <div className="mb-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-center">{beer.name}</h3>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {beer.type}
            </Badge>
            {beer.availability.tap && (
              <HoverCard openDelay={200}>
                <HoverCardTrigger asChild>
                  <span className="inline-flex items-center justify-center cursor-help" onClick={(e) => e.preventDefault()}>
                    <GlassIcon className="h-4 w-4" />
                  </span>
                </HoverCardTrigger>
                <HoverCardContent side="top" className="w-auto p-2">
                  <p className="text-xs">Pouring</p>
                </HoverCardContent>
              </HoverCard>
            )}
          </div>
        </div>
        <Button variant="outline" className="w-full group-hover:bg-muted/50 hover:translate-y-0" tabIndex={-1}>
          View Details
        </Button>
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

      {beer.hops && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Hops:</p>
          <p className="text-sm">{beer.hops}</p>
        </div>
      )}

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
        className="ml-auto hover:translate-y-0"
      >
        <Link
          href={showLocation ? `/${currentLocation}/beer/${beerSlug}` : `/beer/${beerSlug}`}
          className="no-underline"
          onClick={() => trackBeerView(beer.name, beer.type)}
        >
          Details
        </Link>
      </Button>
    </div>
  );

  return (
    <BaseCard
      item={beer}
      variant="detailed"
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
  variant?: 'full' | 'minimal'
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
  return <CardSkeleton variant="detailed" lines={4} />;
});

export default BeerCard;