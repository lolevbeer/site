/**
 * Draft Beer Card Component
 * Row-style layout focused on draft-specific information: tap number, glass type, ABV, and hops
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { Beer, GlassType } from '@/lib/types/beer';
import { useLocationContext } from '@/components/location/location-provider';
import { PintIcon, SteinIcon, TekuIcon } from '@/components/icons';
import { formatAbv, getBeerSlug } from '@/lib/utils/formatters';

interface DraftBeerCardProps {
  beer: Beer;
  showLocation?: boolean;
  className?: string;
  priority?: boolean;
}

function getGlassIcon(glass: GlassType): React.ComponentType<{ className?: string }> {
  switch (glass) {
    case GlassType.PINT:
      return PintIcon;
    case GlassType.TEKU:
      return TekuIcon;
    case GlassType.STEIN:
      return SteinIcon;
    default:
      return PintIcon;
  }
}

export const DraftBeerCard = React.memo(function DraftBeerCard({
  beer,
  showLocation = true,
  className = '',
  priority = false
}: DraftBeerCardProps) {
  const { currentLocation } = useLocationContext();
  const beerSlug = getBeerSlug(beer);
  const GlassIcon = getGlassIcon(beer.glass);

  // Don't show beer if it's hidden from site
  if (beer.availability.hideFromSite) {
    return null;
  }

  return (
    <Link href={showLocation ? `/${currentLocation}/beer/${beerSlug}` : `/beer/${beerSlug}`} className="group">
      <div className={`overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-200 cursor-pointer bg-[var(--color-card-interactive)] rounded-lg border-0 ${className}`}>
        <div className="flex items-center gap-4 p-4">
          {/* Glass Icon */}
          <div className="flex-shrink-0">
            <GlassIcon className="h-12 w-12 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
          </div>

          {/* Beer Info */}
          <div className="flex-grow min-w-0">
            <h3 className="text-lg font-semibold leading-tight truncate">{beer.name}</h3>
            <div className="text-sm text-muted-foreground mt-0.5">{beer.type}</div>
            {beer.hops && (
              <div className="text-xs text-muted-foreground/70 mt-1 truncate">
                {beer.hops}
              </div>
            )}
          </div>

          {/* ABV */}
          <div className="flex-shrink-0 text-right">
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
