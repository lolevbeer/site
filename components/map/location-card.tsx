'use client'

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { capitalizeName } from '@/lib/utils/formatters';
import { googleDirectionsUrl } from '@/lib/map/geo';

interface LocationCardProps {
  name: string;
  address: string;
  distance?: number;
  distanceFromLabel?: string | null;
  isSelected: boolean;
  onClick: () => void;
  innerRef?: React.Ref<HTMLDivElement>;
  badge?: string;
}

export function LocationCard({
  name,
  address,
  distance,
  distanceFromLabel,
  isSelected,
  onClick,
  innerRef,
  badge,
}: LocationCardProps) {
  const directionsUrl = googleDirectionsUrl(address);

  return (
    <div
      ref={innerRef}
      className={cn(
        "p-3 rounded-md",
        "transition-all duration-200 ease-out",
        "hover:bg-secondary",
        isSelected && "bg-secondary"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={onClick}
            aria-pressed={isSelected}
            className="text-left w-full min-h-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
          >
            <span className="font-semibold text-sm truncate block">
              {capitalizeName(name)}
              {badge ? (
                <span className="ml-2 text-[10px] uppercase tracking-wider font-bold text-primary">
                  {badge}
                </span>
              ) : null}
            </span>
          </button>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground mt-1 block hover:text-foreground hover:underline transition-colors"
          >
            {address}
          </a>
          {distance !== undefined && (
            <span className="text-xs font-medium text-primary mt-1 inline-block">
              {distance.toFixed(1)} mi{distanceFromLabel ? ` from ${distanceFromLabel}` : ' away'}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 min-h-6 min-w-6 text-xs shrink-0 hover:bg-primary hover:text-primary-foreground cursor-pointer"
          asChild
        >
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
            Directions
          </a>
        </Button>
      </div>
    </div>
  );
}
