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
}

export const DraftBeerCard = React.memo(function DraftBeerCard({
  beer,
  showLocation = true,
  className = ''
}: DraftBeerCardProps) {
  const { currentLocation } = useLocationContext();
  const beerSlug = getBeerSlug(beer);
  const GlassIcon = getGlassIcon(beer.glass);

  // Don't show beer if it's hidden from site
  if (beer.availability.hideFromSite) {
    return null;
  }

  return (
    <Link href={showLocation ? `/${currentLocation}/beer/${beerSlug}` : `/beer/${beerSlug}`} className="group block">
      <div className={`overflow-hidden transition-colors duration-200 cursor-pointer rounded-lg hover:bg-secondary sm:h-[120.5px] ${className}`}>
        <div className="flex items-start gap-4 p-4 h-full">
          {/* Glass Icon */}
          <div className="flex-shrink-0 pt-1">
            <GlassIcon className="h-12 w-12 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
          </div>

          {/* Beer Info */}
          <div className="flex-grow min-w-0 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
              <h3 className="text-lg font-semibold leading-tight truncate">{beer.name}</h3>
              <div className="flex gap-1 flex-wrap">
                {beer.isJustReleased && (
                  <Badge variant="default" className="text-xs flex-shrink-0 w-fit">
                    Just Released
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs flex-shrink-0 w-fit">
                  {beer.type}
                </Badge>
              </div>
            </div>
            <div className="min-h-[3.5rem]">
              {beer.description && (
                <p className="text-sm text-muted-foreground/80 line-clamp-2 mb-1">
                  {beer.description}
                </p>
              )}
              {beer.hops && (
                <p className="text-xs text-muted-foreground/70 truncate">
                  <span className="font-medium">Hops:</span> {beer.hops}
                </p>
              )}
            </div>
          </div>

          {/* ABV */}
          <div className="flex-shrink-0 text-right pt-1">
            <div className="text-lg font-semibold text-foreground">
              {beer.abv}%
            </div>
            <div className="text-xs text-muted-foreground/60 whitespace-nowrap">
              Alc by Vol
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
});

export default DraftBeerCard;
