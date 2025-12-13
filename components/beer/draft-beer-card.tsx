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
  /** Show tap number and pricing (for fullscreen menu displays) */
  showTapAndPrice?: boolean;
}

export const DraftBeerCard = React.memo(function DraftBeerCard({
  beer,
  showLocation = true,
  className = '',
  showTapAndPrice = false
}: DraftBeerCardProps) {
  const { currentLocation } = useLocationContext();
  const beerSlug = getBeerSlug(beer);
  const GlassIcon = getGlassIcon(beer.glass);

  // Don't show beer if it's hidden from site
  if (beer.availability.hideFromSite) {
    return null;
  }

  // Fullscreen mode uses viewport-relative sizing
  if (showTapAndPrice) {
    return (
      <Link href={`/beer/${beerSlug}`} className="group block h-full">
        <div className={`overflow-hidden transition-colors duration-200 cursor-pointer hover:bg-secondary/50 h-full bg-background ${className}`}>
          <div className="flex items-center h-full" style={{ gap: '1.5vh', padding: '0 1vh' }}>
            {/* Tap Number and Glass Icon */}
            <div className="flex-shrink-0 flex items-center justify-between" style={{ minWidth: '12vh' }}>
              {beer.tap && (
                <span className="font-bold text-primary tabular-nums" style={{ fontSize: '2.2vh' }}>{beer.tap}</span>
              )}
              <div style={{ height: '5vh', width: '5vh' }}>
                <GlassIcon className="w-full h-full text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors" />
              </div>
            </div>

            {/* Beer Info - Main content */}
            <div className="flex-grow min-w-0 flex flex-col" style={{ gap: '0.3vh' }}>
              <div className="flex items-center flex-wrap" style={{ gap: '1vh' }}>
                <h3 className="font-bold leading-tight truncate" style={{ fontSize: '2.2vh' }}>{beer.name}</h3>
                <Badge variant="outline" className="flex-shrink-0 font-normal" style={{ fontSize: '1.3vh' }}>
                  {beer.type}
                </Badge>
                {beer.isJustReleased && (
                  <Badge variant="default" className="flex-shrink-0" style={{ fontSize: '1.3vh' }}>
                    Just Released
                  </Badge>
                )}
              </div>
              <div className="flex flex-col" style={{ gap: '0.2vh' }}>
                {beer.description && (
                  <p className="text-muted-foreground/60 line-clamp-3 leading-tight" style={{ fontSize: '1.4vh' }}>
                    {beer.description}
                  </p>
                )}
                {beer.hops && (
                  <p className="text-muted-foreground/50 truncate leading-tight" style={{ fontSize: '1.2vh' }}>
                    <span className="font-medium">Hops:</span> {beer.hops}
                  </p>
                )}
              </div>
            </div>

            {/* ABV and Price - Right aligned */}
            <div className="flex-shrink-0 flex items-center" style={{ gap: '2vh' }}>
              <div className="text-center" style={{ minWidth: '5vh' }}>
                <div className="font-bold text-foreground tabular-nums" style={{ fontSize: '2.5vh' }}>
                  {beer.abv}%
                </div>
              </div>
              {beer.pricing?.draftPrice && (
                <div className="text-center" style={{ minWidth: '6vh' }}>
                  <div className="font-bold text-primary tabular-nums" style={{ fontSize: '3.5vh' }}>
                    ${beer.pricing.draftPrice}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // Standard mode with Tailwind classes
  return (
    <Link href={showLocation ? `/${currentLocation}/beer/${beerSlug}` : `/beer/${beerSlug}`} className="group block h-full">
      <div className={`overflow-hidden transition-colors duration-200 cursor-pointer hover:bg-secondary/50 h-full min-h-[80px] bg-background ${className}`}>
        <div className="flex items-center gap-6 px-4 h-full">
          {/* Tap Number and Glass Icon */}
          <div className="flex-shrink-0 flex items-center gap-3">
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
              <div className="text-lg font-bold text-foreground tabular-nums">
                {beer.abv}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
});

export default DraftBeerCard;
