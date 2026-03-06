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
import { BeerImage } from './beer-image';
import {
  formatAbv,
  getBeerSlug,
  getBeerAvailability,
  getBeerPricing
} from '@/lib/utils/formatters';
import { getGlassIcon } from '@/lib/utils/beer-icons';
import { trackBeerView } from '@/lib/analytics/events';
import { TopBeerDropsLink } from '@/components/beer/top-beer-drops-link';
import { UntappdRating } from '@/components/beer/untappd-rating';
import { MotionCard } from '@/components/motion';

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
  const GlassIcon = getGlassIcon(beer.glass);

  // Don't show beer if it's hidden from site
  if (beer.availability.hideFromSite) {
    return null;
  }

  // Minimal variant uses simple card structure without BaseCard - matches homepage cans style
  if (variant === 'minimal') {
    const beerHref = showLocation ? `/${currentLocation}/beer/${beerSlug}` : `/beer/${beerSlug}`;

    return (
      <MotionCard glow>
        <Link
          href={beerHref}
          onClick={() => trackBeerView(beer.name, beer.type)}
          className="group flex flex-col cursor-pointer transition-transform duration-200"
        >
          <div className="relative h-64 w-full flex-shrink-0 mb-4 transition-transform duration-200">
            <BeerImage
              beer={beer}
              className="w-full h-full"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              priority={priority}
            />
          </div>
          <div className="mb-3">
            <h3 className="text-xl font-semibold text-center mb-2">{beer.name}</h3>
            <div className="flex items-center justify-center gap-2">
              <UntappdRating rating={beer.untappdRating} />
              <Badge variant="outline" className="text-xs">
                {beer.type}
              </Badge>
              {beer.topBeerDrops && (
                <TopBeerDropsLink url={beer.topBeerDrops} className="h-6 w-6 text-foreground hover:text-primary transition-colors" />
              )}
            </div>
          </div>
          <Button variant="outline" className="w-full group-hover:bg-muted/50 hover:translate-y-0" tabIndex={-1}>
            View Details
          </Button>
        </Link>
      </MotionCard>
    );
  }

  const renderHeader = (beer: Beer) => (
    <>
      <div className="relative">
        <BeerImage
          beer={beer}
          className="aspect-square w-full mb-4 rounded-lg"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority={priority}
        />
        <UntappdRating rating={beer.untappdRating} variant="overlay" className="absolute bottom-6 left-2 z-10" />
        {beer.topBeerDrops && (
          <div className="absolute bottom-6 right-2 z-10">
            <TopBeerDropsLink url={beer.topBeerDrops} className="h-7 w-7 text-foreground hover:text-primary transition-colors drop-shadow-md" />
          </div>
        )}
        {beer.glutenFree && (
          <div className="absolute top-2 right-2 z-10">
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
            <GlassIcon className="h-4 w-4" />
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
    <MotionCard glow>
      <BaseCard
        item={beer}
        variant="detailed"
        className={`group hover:translate-y-0 ${className}`}
        renderHeader={renderHeader}
        renderContent={renderContent}
        renderFooter={renderFooter}
      />
    </MotionCard>
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