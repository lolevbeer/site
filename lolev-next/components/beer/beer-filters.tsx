/**
 * Beer Filters Component
 * Provides filtering and search functionality for beer listings
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import type { BeerFilters } from '@/lib/types/beer';
import { BeerStyle } from '@/lib/types/beer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          type="button"
          aria-label="Clear search"
        >
          ✕
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
  const toggleStyle = useCallback((style: BeerStyle) => {
    if (selectedStyles.includes(style)) {
      onStylesChange(selectedStyles.filter(s => s !== style));
    } else {
      onStylesChange([...selectedStyles, style]);
    }
  }, [selectedStyles, onStylesChange]);

  const clearStyles = useCallback(() => {
    onStylesChange([]);
  }, [onStylesChange]);

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

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {BEER_STYLES.map((style) => (
          <label
            key={style}
            className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-1 rounded"
          >
            <input
              type="checkbox"
              checked={selectedStyles.includes(style)}
              onChange={() => toggleStyle(style)}
              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-2"
            />
            <span className="text-sm flex-1">{style}</span>
          </label>
        ))}
      </div>

      {selectedStyles.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-2 border-t">
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">ABV Range</h4>
        {abvRange && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearRange}
            className="h-auto py-1 px-2 text-xs"
          >
            Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Min %</label>
          <input
            type="number"
            value={localRange.min}
            onChange={(e) => handleMinChange(e.target.value)}
            min="0"
            max="20"
            step="0.1"
            className="w-full px-2 py-1 text-sm border border-input rounded bg-background"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Max %</label>
          <input
            type="number"
            value={localRange.max}
            onChange={(e) => handleMaxChange(e.target.value)}
            min="0"
            max="20"
            step="0.1"
            className="w-full px-2 py-1 text-sm border border-input rounded bg-background"
          />
        </div>
      </div>

      <div className="text-xs text-muted-foreground text-center">
        {localRange.min}% - {localRange.max}%
      </div>
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
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Availability</h4>

      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-1 rounded"
          >
            <input
              type="radio"
              name="availability"
              value={option.value}
              checked={availability === option.value || (!availability && option.value === 'all')}
              onChange={() => onAvailabilityChange(option.value === 'all' ? undefined : option.value)}
              className="w-4 h-4 text-primary border-gray-300 focus:ring-primary focus:ring-2"
            />
            <span className="text-sm">{option.label}</span>
          </label>
        ))}
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
    onFiltersChange({
      ...filters,
      search: search || undefined,
    });
  }, [filters, onFiltersChange]);

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
    <Card className={`shadow-none ${className}`}>
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