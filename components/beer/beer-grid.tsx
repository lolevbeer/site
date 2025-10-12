/**
 * Beer Grid Component
 * Responsive grid layout for displaying beer cards
 */

'use client';

import React from 'react';
import { Beer, BeerSortOptions, BeerSortBy, BeerSortOrder } from '@/lib/types/beer';
import { BeerCard } from './beer-card';

interface BeerGridProps {
  beers: Beer[];
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  showLocation?: boolean;
  showPricing?: boolean;
  showAvailability?: boolean;
  sortOptions?: BeerSortOptions;
  onSortChange?: (sortOptions: BeerSortOptions) => void;
  className?: string;
}

function sortBeers(beers: Beer[], sortOptions?: BeerSortOptions): Beer[] {
  if (!sortOptions) {
    return beers;
  }

  const { sortBy, order } = sortOptions;

  return [...beers].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'abv':
        comparison = a.abv - b.abv;
        break;
      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;
      case 'tap':
        const aTap = a.availability.tap ? parseInt(a.availability.tap) : 999;
        const bTap = b.availability.tap ? parseInt(b.availability.tap) : 999;
        comparison = aTap - bTap;
        break;
      default:
        comparison = 0;
    }

    return order === 'desc' ? -comparison : comparison;
  });
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="bg-card rounded-xl border shadow-sm animate-pulse"
        >
          <div className="p-6">
            <div className="aspect-square w-full mb-4 bg-muted rounded-lg" />
            <div className="h-6 bg-muted rounded mb-2" />
            <div className="h-4 bg-muted rounded w-3/4 mb-4" />
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          </div>
          <div className="p-6 pt-0">
            <div className="h-8 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
      <div className="text-6xl mb-4">🍺</div>
      <h3 className="text-lg font-semibold mb-2">No Beers Found</h3>
      <p className="text-muted-foreground max-w-md">
        {message}
      </p>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
      <div className="text-6xl mb-4">⚠️</div>
      <h3 className="text-lg font-semibold mb-2">Error Loading Beers</h3>
      <p className="text-muted-foreground max-w-md">
        {error}
      </p>
    </div>
  );
}

function SortControls({
  sortOptions,
  onSortChange
}: {
  sortOptions?: BeerSortOptions;
  onSortChange?: (sortOptions: BeerSortOptions) => void;
}) {
  if (!onSortChange) {
    return null;
  }

  const handleSortByChange = (sortBy: BeerSortBy) => {
    if (sortOptions) {
      onSortChange({ ...sortOptions, sortBy });
    } else {
      onSortChange({ sortBy, order: 'asc' });
    }
  };

  const handleOrderChange = () => {
    if (sortOptions) {
      const newOrder: BeerSortOrder = sortOptions.order === 'asc' ? 'desc' : 'asc';
      onSortChange({ ...sortOptions, order: newOrder });
    }
  };

  return (
    <div className="flex items-center gap-4 mb-6">
      <span className="text-sm font-medium text-muted-foreground">Sort by:</span>

      <div className="flex items-center gap-2">
        <select
          value={sortOptions?.sortBy || 'name'}
          onChange={(e) => handleSortByChange(e.target.value as BeerSortBy)}
          className="text-sm border rounded-md px-2 py-1 bg-background"
        >
          <option value="name">Name</option>
          <option value="type">Style</option>
          <option value="abv">ABV</option>
          <option value="tap">Tap Number</option>
        </select>

        <button
          onClick={handleOrderChange}
          className="text-sm px-2 py-1 border rounded-md hover:bg-muted transition-colors"
          title={`Sort ${sortOptions?.order === 'asc' ? 'descending' : 'ascending'}`}
        >
          {sortOptions?.order === 'asc' ? '↑' : '↓'}
        </button>
      </div>
    </div>
  );
}

export function BeerGrid({
  beers,
  loading = false,
  error,
  emptyMessage = "We couldn't find any beers matching your criteria. Try adjusting your filters or check back later for new releases.",
  showLocation = true,
  showPricing = true,
  showAvailability = true,
  sortOptions,
  onSortChange,
  className = '',
}: BeerGridProps) {
  // Filter out hidden beers
  const visibleBeers = beers.filter(beer => !beer.availability.hideFromSite);

  // Sort beers if sort options are provided
  const sortedBeers = sortBeers(visibleBeers, sortOptions);

  if (loading) {
    return (
      <div className={className}>
        <LoadingGrid />
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="grid grid-cols-1">
          <ErrorState error={error} />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {onSortChange && sortedBeers.length > 0 && (
        <SortControls
          sortOptions={sortOptions}
          onSortChange={onSortChange}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sortedBeers.length > 0 ? (
          sortedBeers.map((beer) => (
            <BeerCard
              key={beer.variant}
              beer={beer}
              showLocation={showLocation}
              showPricing={showPricing}
              showAvailability={showAvailability}
            />
          ))
        ) : (
          <EmptyState message={emptyMessage} />
        )}
      </div>

      {sortedBeers.length > 0 && (
        <div className="mt-8 text-center text-sm text-muted-foreground">
          Showing {sortedBeers.length} beer{sortedBeers.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

export default BeerGrid;