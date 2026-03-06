/**
 * Beer Page Content Component
 * Client component for interactive beer listing with inline filters.
 * Uses nuqs for URL-based filter persistence (shareable/bookmarkable).
 */

'use client';

import React, { useMemo, useCallback } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { Beer } from '@/lib/types/beer';
import { BeerCard } from '@/components/beer/beer-card';
import { Button } from '@/components/ui/button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import { Search, X, Beer as BeerIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { StaggerChildren, StaggerItem } from '@/components/motion';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { PageTransition } from '@/components/motion';

interface BeerPageContentProps {
  beers: Beer[];
}

export function BeerPageContent({ beers }: BeerPageContentProps) {
  const [search, setSearch] = useQueryState('q', { defaultValue: '' });
  const [availability, setAvailability] = useQueryState('avail', parseAsString.withDefault('all'));
  const [selectedType, setSelectedType] = useQueryState('style', { defaultValue: 'all' });

  const beerTypes = useMemo(() => {
    const types = new Set<string>();
    beers.forEach(beer => {
      if (beer.type) types.add(beer.type);
    });
    return Array.from(types).sort();
  }, [beers]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value || null);
  }, [setSearch]);

  const handleAvailabilityChange = useCallback((value: string) => {
    setAvailability(value === 'all' ? null : value);
  }, [setAvailability]);

  const handleTypeChange = useCallback((type: string) => {
    setSelectedType(type === 'all' ? null : type);
  }, [setSelectedType]);

  const clearFilters = useCallback(() => {
    setSearch(null);
    setAvailability(null);
    setSelectedType(null);
  }, [setSearch, setAvailability, setSelectedType]);

  const hasActiveFilters = search || availability !== 'all' || selectedType !== 'all';

  const filteredBeers = useMemo(() => {
    let filtered = [...beers];

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        beer =>
          beer.name.toLowerCase().includes(searchLower) ||
          beer.description?.toLowerCase().includes(searchLower) ||
          beer.type?.toLowerCase().includes(searchLower)
      );
    }

    if (selectedType && selectedType !== 'all') {
      filtered = filtered.filter(beer => beer.type === selectedType);
    }

    if (availability === 'tap') {
      filtered = filtered.filter(beer => {
        return !!(
          beer.availability?.tap ||
          Object.values(beer.availability || {}).some(
            val => typeof val === 'object' && val !== null && 'tap' in val && val.tap
          )
        );
      });
    } else if (availability === 'cans') {
      filtered = filtered.filter(beer => {
        return !!(
          beer.availability?.cansAvailable ||
          Object.values(beer.availability || {}).some(
            val => typeof val === 'object' && val !== null && 'cansAvailable' in val && val.cansAvailable
          )
        );
      });
    }

    // Sort by recipe number descending, beers without recipe go last
    filtered.sort((a, b) => {
      const recipeA = a.recipe ?? -Infinity;
      const recipeB = b.recipe ?? -Infinity;
      return recipeB - recipeA;
    });

    return filtered;
  }, [beers, search, selectedType, availability]);

  return (
    <PageTransition>
    <div className="container mx-auto px-4 py-8">
      <PageBreadcrumbs className="mb-6" />

      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Our Beers</h1>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-16 z-20 glass rounded-lg p-3 mb-6">
        <div className="flex items-center gap-3">
          {/* Search - 1/3 */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search beers..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 bg-secondary"
            />
            {search && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                type="button"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Availability - 1/3 */}
          <ToggleGroup
            type="single"
            value={availability}
            onValueChange={(val) => handleAvailabilityChange(val || 'all')}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="tap">Draft</ToggleGroupItem>
            <ToggleGroupItem value="cans">In Cans</ToggleGroupItem>
          </ToggleGroup>

          {/* Style dropdown - 1/3 */}
          <Select value={selectedType} onValueChange={handleTypeChange}>
            <SelectTrigger className="flex-1 bg-secondary">
              <SelectValue placeholder="All Styles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Styles</SelectItem>
              {beerTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Beer Grid - Full width */}
      {filteredBeers.length > 0 ? (
        <StaggerChildren inView className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredBeers.map((beer, index) => (
            <StaggerItem key={`${beer.variant}-${index}`}>
              <BeerCard
                beer={beer}
                variant="minimal"
                showLocation={false}
              />
            </StaggerItem>
          ))}
        </StaggerChildren>
      ) : (
        <Empty className="border border-dashed border-border/60 rounded-xl p-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BeerIcon className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle className="text-xl">No Beers Found</EmptyTitle>
            <EmptyDescription className="text-muted-foreground/70">
              {search && selectedType !== 'all'
                ? `No ${selectedType} beers matching "${search}"`
                : search
                ? `No beers matching "${search}"`
                : selectedType !== 'all'
                ? `No ${selectedType} beers available`
                : 'No beers match your current filters'}
            </EmptyDescription>
          </EmptyHeader>
          {hasActiveFilters && (
            <EmptyContent>
              <Button variant="outline" onClick={clearFilters}>
                Clear all filters
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}
    </div>
    </PageTransition>
  );
}
