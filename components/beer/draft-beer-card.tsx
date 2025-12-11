/**
 * Draft Beer Card Component
 * Row-style layout focused on draft-specific information: tap number, glass type, ABV, and hops
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { Beer } from '@/lib/types/beer';
import { useLocationContext } from '@/components/location/location-provider';
import { getBeerSlug } from '@/lib/utils/formatters';
import { getGlassIcon } from '@/lib/utils/beer-icons';
import { Badge } from '@/components/ui/badge';

interface DraftBeerCardProps {
  beer: Beer;
  showLocation?: boolean;
  className?: string;
  /** Index for zebra striping */
  index?: number;
  /** Show tap number and pricing (for fullscreen menu displays) */
  showTapAndPrice?: boolean;
}

export const DraftBeerCard = React.memo(function DraftBeerCard({
  beer,
  showLocation = true,
  className = '',
  index = 0,
  showTapAndPrice = false
}: DraftBeerCardProps) {
  const { currentLocation } = useLocationContext();
  const beerSlug = getBeerSlug(beer);
  const GlassIcon = getGlassIcon(beer.glass);

  // Don't show beer if it's hidden from site
  if (beer.availability.hideFromSite) {
    return null;
  }

  // Zebra striping - alternating subtle backgrounds
  const rowBg = index % 2 === 0 ? 'bg-background' : 'bg-muted/30';

  return (
    <Link href={showLocation ? `/${currentLocation}/beer/${beerSlug}` : `/beer/${beerSlug}`} className="group block h-full">
      <div className={`overflow-hidden transition-colors duration-200 cursor-pointer hover:bg-secondary/50 h-full min-h-[80px] ${rowBg} ${className}`}>
        <div className="flex items-center gap-6 px-4 h-full">
          {/* Tap Number and Glass Icon */}
          <div className="flex-shrink-0 flex items-center gap-3">
            {showTapAndPrice && beer.tap && (
              <span className="text-4xl font-bold text-primary tabular-nums">{beer.tap}</span>
            )}
            <GlassIcon className="h-8 w-8 text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors" />
          </div>

          {/* Beer Info - Main content */}
          <div className="flex-grow min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-xl font-bold leading-tight truncate">{beer.name}</h3>
              {beer.isJustReleased && (
                <Badge variant="default" className="text-xs flex-shrink-0">
                  Just Released
                </Badge>
              )}
              <Badge variant="outline" className="text-sm flex-shrink-0 font-normal">
                {beer.type}
              </Badge>
            </div>
            <div className="flex flex-col gap-0.5">
              {beer.description && (
                <p className="text-sm text-muted-foreground/60 line-clamp-1 leading-tight">
                  {beer.description}
                </p>
              )}
              {beer.hops && (
                <p className="text-xs text-muted-foreground/50 truncate leading-tight">
                  <span className="font-medium">Hops:</span> {beer.hops}
                </p>
              )}
            </div>
          </div>

          {/* ABV and Price - Right aligned */}
          <div className="flex-shrink-0 flex items-center gap-6">
            <div className="text-center">
              <div className={`${showTapAndPrice ? 'text-2xl' : 'text-lg'} font-bold text-foreground tabular-nums`}>
                {beer.abv}%
              </div>
            </div>
            {showTapAndPrice && beer.pricing?.draftPrice && (
              <div className="text-center min-w-[50px]">
                <div className="text-2xl font-bold text-primary tabular-nums">
                  ${beer.pricing.draftPrice}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
});

export default DraftBeerCard;
