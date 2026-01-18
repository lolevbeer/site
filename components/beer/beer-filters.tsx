/**
 * Beer Filters Component
 * Provides filtering and search functionality for beer listings
 */

'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { BeerFilters } from '@/lib/types/beer';
import { BeerStyle } from '@/lib/types/beer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ChevronDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackBeerFilter, trackSearch } from '@/lib/analytics/events';

interface BeerFiltersProps {
  filters: BeerFilters;
  onFiltersChange: (filters: BeerFilters) => void;
  totalCount?: number;
  filteredCount?: number;
  className?: string;
}

interface ABVRange {
  min: number;
  max: number;
}

const BEER_STYLES = Object.values(BeerStyle);

const DEFAULT_ABV_RANGE: ABVRange = { min: 0, max: 15 };

function SearchInput({
  value,
  onChange,
  placeholder = "Search beers...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <label htmlFor="beer-search" className="sr-only">
        Search beers
      </label>
      <Input
        id="beer-search"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search beers by name or description"
        className={value ? "pr-8" : ""}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          type="button"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function StyleFilter({
  selectedStyles,
  onStylesChange,
}: {
  selectedStyles: BeerStyle[];
  onStylesChange: (styles: BeerStyle[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggleStyle = useCallback((style: BeerStyle) => {
    if (selectedStyles.includes(style)) {
      trackBeerFilter('style_remove', style);
      onStylesChange(selectedStyles.filter(s => s !== style));
    } else {
      trackBeerFilter('style_add', style);
      onStylesChange([...selectedStyles, style]);
    }
  }, [selectedStyles, onStylesChange]);

  const clearStyles = useCallback(() => {
    onStylesChange([]);
  }, [onStylesChange]);

  const triggerLabel = selectedStyles.length === 0
    ? "Select styles..."
    : selectedStyles.length === 1
      ? selectedStyles[0]
      : `${selectedStyles.length} styles selected`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Beer Styles</h4>
        {selectedStyles.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearStyles}
            className="h-auto py-1 px-2 text-xs"
          >
            Clear
          </Button>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="max-h-60 overflow-y-auto p-1">
            {BEER_STYLES.map((style) => {
              const isSelected = selectedStyles.includes(style);
              return (
                <button
                  key={style}
                  onClick={() => toggleStyle(style)}
                  className={cn(
                    "relative flex w-full cursor-pointer items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent/50"
                  )}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    {isSelected && <Check className="h-4 w-4" />}
                  </span>
                  {style}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {selectedStyles.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedStyles.map((style) => (
            <Badge
              key={style}
              variant="secondary"
              className="text-xs cursor-pointer hover:bg-secondary/80"
              onClick={() => toggleStyle(style)}
              role="button"
              tabIndex={0}
              aria-label={`Remove ${style} filter`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleStyle(style);
                }
              }}
            >
              {style} ✕
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function ABVRangeFilter({
  abvRange,
  onABVRangeChange,
}: {
  abvRange?: ABVRange;
  onABVRangeChange: (range?: ABVRange) => void;
}) {
  const [localRange, setLocalRange] = useState<ABVRange>(
    abvRange || DEFAULT_ABV_RANGE
  );

  // Sync local state with prop when it changes externally (e.g., clear all filters)
  useEffect(() => {
    setLocalRange(abvRange || DEFAULT_ABV_RANGE);
  }, [abvRange]);

  const handleMinChange = useCallback((value: string) => {
    const min = parseFloat(value) || 0;
    const newRange = { ...localRange, min };
    setLocalRange(newRange);
    onABVRangeChange(newRange);
  }, [localRange, onABVRangeChange]);

  const handleMaxChange = useCallback((value: string) => {
    const max = parseFloat(value) || 15;
    const newRange = { ...localRange, max };
    setLocalRange(newRange);
    onABVRangeChange(newRange);
  }, [localRange, onABVRangeChange]);

  const clearRange = useCallback(() => {
    setLocalRange(DEFAULT_ABV_RANGE);
    onABVRangeChange(undefined);
  }, [onABVRangeChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium whitespace-nowrap">Alc by Volume</h4>
        <div className="flex items-center gap-2">
          <input
            id="abv-min"
            type="number"
            value={localRange.min}
            onChange={(e) => handleMinChange(e.target.value)}
            min="0"
            max="20"
            step="0.1"
            className="w-16 px-2 py-1 text-sm border border-input rounded bg-background"
            aria-label="Minimum ABV percentage"
            placeholder="Min"
          />
          <span className="text-muted-foreground text-sm">-</span>
          <input
            id="abv-max"
            type="number"
            value={localRange.max}
            onChange={(e) => handleMaxChange(e.target.value)}
            min="0"
            max="20"
            step="0.1"
            className="w-16 px-2 py-1 text-sm border border-input rounded bg-background"
            aria-label="Maximum ABV percentage"
            placeholder="Max"
          />
          {abvRange && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearRange}
              className="h-auto py-1 px-2 text-xs"
            >
              Clear
            </Button>
          )}
        </div>
      </div>
      {(localRange.min > 0 || localRange.max < 15) && (
        <div className="text-xs text-muted-foreground text-right">
          {localRange.min}% - {localRange.max}%
        </div>
      )}
    </div>
  );
}

function AvailabilityFilter({
  availability,
  onAvailabilityChange,
}: {
  availability?: 'draft' | 'cans' | 'all';
  onAvailabilityChange: (availability?: 'draft' | 'cans' | 'all') => void;
}) {
  const options = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Pouring' },
    { value: 'cans', label: 'Cans Available' },
  ] as const;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium whitespace-nowrap">Availability</h4>
        <div className="flex gap-1.5">
          {options.map((option) => (
            <Button
              key={option.value}
              variant={availability === option.value || (!availability && option.value === 'all') ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                trackBeerFilter('availability', option.value);
                onAvailabilityChange(option.value === 'all' ? undefined : option.value);
              }}
              className="text-xs px-2.5 h-8"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GlutenFreeFilter({
  glutenFree,
  onGlutenFreeChange,
}: {
  glutenFree?: boolean;
  onGlutenFreeChange: (glutenFree?: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Dietary</h4>

      <label className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
        <input
          type="checkbox"
          checked={glutenFree === true}
          onChange={(e) => onGlutenFreeChange(e.target.checked ? true : undefined)}
          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-2"
        />
        <span className="text-sm">Gluten Free Only</span>
      </label>
    </div>
  );
}

export function BeerFilters({
  filters,
  onFiltersChange,
  totalCount,
  filteredCount,
  className = '',
}: BeerFiltersProps) {
  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.search ||
      (filters.style && filters.style.length > 0) ||
      filters.abvRange ||
      filters.availability ||
      filters.glutenFree
    );
  }, [filters]);

  const handleSearchChange = useCallback((search: string) => {
    if (search && search.length >= 3) {
      trackSearch(search, filteredCount || 0);
    }
    onFiltersChange({
      ...filters,
      search: search || undefined,
    });
  }, [filters, onFiltersChange, filteredCount]);

  const handleStylesChange = useCallback((styles: BeerStyle[]) => {
    onFiltersChange({
      ...filters,
      style: styles.length > 0 ? styles : undefined,
    });
  }, [filters, onFiltersChange]);

  const handleABVRangeChange = useCallback((abvRange?: ABVRange) => {
    onFiltersChange({
      ...filters,
      abvRange: abvRange && (abvRange.min > 0 || abvRange.max < 15) ? abvRange : undefined,
    });
  }, [filters, onFiltersChange]);

  const handleAvailabilityChange = useCallback((availability?: 'draft' | 'cans' | 'all') => {
    onFiltersChange({
      ...filters,
      availability,
    });
  }, [filters, onFiltersChange]);

  const handleGlutenFreeChange = useCallback((glutenFree?: boolean) => {
    onFiltersChange({
      ...filters,
      glutenFree,
    });
  }, [filters, onFiltersChange]);

  const clearAllFilters = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  return (
    <Card className={`shadow-none bg-transparent border-border ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Filter Beers</CardTitle>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
              className="h-auto py-1 px-3"
            >
              Clear All
            </Button>
          )}
        </div>

        {typeof totalCount === 'number' && typeof filteredCount === 'number' && (
          <p className="text-sm text-muted-foreground">
            Showing {filteredCount} of {totalCount} beers
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Search */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Search</h4>
          <SearchInput
            value={filters.search || ''}
            onChange={handleSearchChange}
            placeholder="Search by name or description..."
          />
        </div>

        {/* Beer Styles */}
        <StyleFilter
          selectedStyles={filters.style || []}
          onStylesChange={handleStylesChange}
        />

        {/* ABV Range */}
        <ABVRangeFilter
          abvRange={filters.abvRange}
          onABVRangeChange={handleABVRangeChange}
        />

        {/* Availability */}
        <AvailabilityFilter
          availability={filters.availability}
          onAvailabilityChange={handleAvailabilityChange}
        />

        {/* Gluten Free */}
        <GlutenFreeFilter
          glutenFree={filters.glutenFree}
          onGlutenFreeChange={handleGlutenFreeChange}
        />
      </CardContent>
    </Card>
  );
}

export default BeerFilters;