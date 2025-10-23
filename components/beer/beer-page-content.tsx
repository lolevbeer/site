/**
 * Beer Page Content Component
 * Client component for interactive beer listing functionality
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Beer, BeerStyle } from '@/lib/types/beer';
import type { LocationFilter } from '@/lib/types/location';
import { BeerCard } from '@/components/beer/beer-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X, ChevronDown, ArrowUpDown, SignalLow, SignalMedium, SignalHigh, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useBeerFilters } from '@/lib/hooks/use-beer-filters';
import { ABV_LEVELS, type ABVLevel } from '@/lib/constants/beer-filters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';

interface BeerPageContentProps {
  beers: Beer[];
}

type SortOption = 'name' | 'abv-asc' | 'abv-desc' | 'type';

export function BeerPageContent({ beers }: BeerPageContentProps) {
  // Beer page always shows all beers regardless of location filter
  const locationFilter = 'all' as LocationFilter;

  // Use shared filtering hook
  const {
    filteredBeers: hookFilteredBeers,
    filters,
    setFilters,
    clearFilters: hookClearFilters,
  } = useBeerFilters({
    beers,
    locationFilter,
  });

  // Local UI state
  const [selectedType, setSelectedType] = useState<string>('all');
  const [abvLevels, setAbvLevels] = useState<ABVLevel[]>([]);
  const [showOnTap, setShowOnTap] = useState(true);
  const [showInCans, setShowInCans] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [showFilters, setShowFilters] = useState(false);

  // Handle ABV level changes
  const handleABVLevelsChange = useCallback((values: string[]) => {
    const levels = values as ABVLevel[];
    setAbvLevels(levels);

    // Update filters with ABV range based on selected levels
    if (levels.length === 0) {
      setFilters(prev => ({ ...prev, abvRange: undefined }));
    } else {
      // Get the min of all selected levels and max of all selected levels
      const ranges = levels.map(level => {
        const levelData = Object.values(ABV_LEVELS).find(l => l.value === level);
        return levelData ? { min: levelData.min, max: levelData.max } : null;
      }).filter(Boolean) as { min: number; max: number }[];

      if (ranges.length > 0) {
        const min = Math.min(...ranges.map(r => r.min));
        const max = Math.max(...ranges.map(r => r.max));
        setFilters(prev => ({ ...prev, abvRange: { min, max } }));
      }
    }
  }, [setFilters]);

  // Handle search changes
  const handleSearchChange = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, search: value || undefined }));
  }, [setFilters]);

  // Get unique beer types from filtered beers
  const beerTypes = useMemo(() => {
    const types = new Set<string>();
    hookFilteredBeers.forEach(beer => {
      if (beer.type) types.add(beer.type);
    });
    return Array.from(types).sort();
  }, [hookFilteredBeers]);

  // Handle type filter changes
  const handleTypeChange = useCallback((type: string) => {
    setSelectedType(type);
    if (type === 'all') {
      setFilters(prev => ({ ...prev, style: undefined }));
    } else {
      // Type is coming from beer data which uses string types, cast to BeerStyle
      setFilters(prev => ({ ...prev, style: [type as BeerStyle] }));
    }
  }, [setFilters]);

  // Apply additional local filters (availability toggles) and sorting
  const filteredBeers = useMemo(() => {
    let filtered = [...hookFilteredBeers];

    // Apply availability toggle filters (on tap / in cans)
    // Only skip filtering if BOTH are disabled (show all beers)
    if (showOnTap || showInCans) {
      filtered = filtered.filter(beer => {
        // Check availability at ANY location (Lawrenceville OR Zelienople)
        const isOnTapAnywhere = !!(
          beer.availability?.lawrenceville?.tap ||
          beer.availability?.zelienople?.tap
        );

        const isInCansAnywhere = !!(
          beer.availability?.lawrenceville?.cansAvailable ||
          beer.availability?.zelienople?.cansAvailable
        );

        const matchesOnTap = showOnTap && isOnTapAnywhere;
        const matchesInCans = showInCans && isInCansAnywhere;

        // Show beer if it matches ANY of the enabled filters
        return matchesOnTap || matchesInCans;
      });
    }
    // If both are disabled, show all beers (no filtering)

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'abv-asc':
          return a.abv - b.abv;
        case 'abv-desc':
          return b.abv - a.abv;
        case 'type':
          return (a.type || '').localeCompare(b.type || '');
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [hookFilteredBeers, showOnTap, showInCans, sortBy]);

  const clearFilters = useCallback(() => {
    hookClearFilters();
    setSelectedType('all');
    setAbvLevels([]);
    setShowOnTap(true);
    setShowInCans(true);
    setSortBy('name');
  }, [hookClearFilters]);

  const localActiveFilterCount = [
    selectedType !== 'all',
    abvLevels.length > 0,
    // Only count as active if different from defaults (both on)
    (!showOnTap || !showInCans),
  ].filter(Boolean).length;

  return (
    <div className="container mx-auto px-4 py-8">
      <PageBreadcrumbs className="mb-6" />
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Our Beers</h1>
      </div>

      {/* Sort and Mobile Filter Controls */}
      <div className="flex items-center justify-between mb-6">
        {/* Mobile Filter Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="lg:hidden bg-secondary"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {localActiveFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {localActiveFilterCount}
            </Badge>
          )}
        </Button>

        {/* Sort Dropdown - Always visible */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="min-w-[140px] ml-auto bg-secondary">
              <ArrowUpDown className="mr-2 h-4 w-4" />
              Sort by
              <ChevronDown className="ml-auto h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuLabel>Sort Options</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setSortBy('name')}
              className={cn("cursor-pointer", sortBy === 'name' && "bg-muted")}
            >
              Name (A-Z)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortBy('abv-asc')}
              className={cn("cursor-pointer", sortBy === 'abv-asc' && "bg-muted")}
            >
              ABV (Low to High)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortBy('abv-desc')}
              className={cn("cursor-pointer", sortBy === 'abv-desc' && "bg-muted")}
            >
              ABV (High to Low)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile Filters */}
      {showFilters && (
        <Card className="lg:hidden mb-6 border-0 shadow-none bg-transparent">
          <CardHeader className="p-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Filters</CardTitle>
                <span className="text-sm text-muted-foreground">
                  {filteredBeers.length} {filteredBeers.length === 1 ? 'beer' : 'beers'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {localActiveFilterCount > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-auto p-1"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Reset filters</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(false)}
                  className="h-auto p-1"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            {/* Mobile search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search beers..."
                value={filters.search || ''}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8 bg-secondary"
              />
            </div>

            {/* Mobile type filter */}
            <Select value={selectedType} onValueChange={handleTypeChange}>
              <SelectTrigger className="w-full bg-secondary">
                <SelectValue placeholder="Filter Styles" className="text-muted-foreground/60 placeholder:text-muted-foreground/60" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Filter Styles</SelectItem>
                {beerTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Mobile availability filters */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={showOnTap ? "default" : "outline"}
                size="sm"
                onClick={() => setShowOnTap(!showOnTap)}
              >
                Pouring
              </Button>
              <Button
                variant={showInCans ? "default" : "outline"}
                size="sm"
                onClick={() => setShowInCans(!showInCans)}
              >
                In Cans
              </Button>
            </div>

            {/* Mobile ABV filters */}
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm whitespace-nowrap">Alc by Volume</Label>
              <ToggleGroup
                type="multiple"
                variant="outline"
                value={abvLevels}
                onValueChange={handleABVLevelsChange}
                className="justify-end"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem value="low" aria-label="Low ABV (0-5%)">
                      <SignalLow className="h-4 w-4" />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Low (0-5%)</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem value="medium" aria-label="Medium ABV (5-7%)">
                      <SignalMedium className="h-4 w-4" />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Medium (5-7%)</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem value="high" aria-label="High ABV (7%+)">
                      <SignalHigh className="h-4 w-4" />
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>High (7%+)</p>
                  </TooltipContent>
                </Tooltip>
              </ToggleGroup>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar - Desktop */}
        <div className="hidden lg:block">
          <Card className="border-0 shadow-none bg-transparent">
            <CardHeader className="pl-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle>Filters</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {filteredBeers.length} {filteredBeers.length === 1 ? 'beer' : 'beers'}
                  </span>
                </div>
                {localActiveFilterCount > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-auto p-0"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Reset filters</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pl-0">
              {/* Search */}
              <div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search beers..."
                    value={filters.search || ''}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-8 bg-secondary"
                  />
                </div>
              </div>

              {/* Type Filter */}
              <div>
                <Select value={selectedType} onValueChange={handleTypeChange}>
                  <SelectTrigger className="w-full bg-secondary">
                    <SelectValue placeholder="Filter Styles" className="text-muted-foreground/60 placeholder:text-muted-foreground/60" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Filter Styles</SelectItem>
                    {beerTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Availability Filters */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="on-tap" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Pouring
                  </label>
                  <Switch
                    id="on-tap"
                    checked={showOnTap}
                    onCheckedChange={setShowOnTap}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label htmlFor="in-cans" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    In Cans
                  </label>
                  <Switch
                    id="in-cans"
                    checked={showInCans}
                    onCheckedChange={setShowInCans}
                  />
                </div>
              </div>

              {/* ABV Levels */}
              <div className="flex items-center justify-between gap-3">
                <Label className="whitespace-nowrap">Alc by Volume</Label>
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  value={abvLevels}
                  onValueChange={handleABVLevelsChange}
                  className="justify-end"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ToggleGroupItem value="low" aria-label="Low ABV (0-5%)">
                        <SignalLow className="h-4 w-4" />
                      </ToggleGroupItem>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Low (0-5%)</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ToggleGroupItem value="medium" aria-label="Medium ABV (5-7%)">
                        <SignalMedium className="h-4 w-4" />
                      </ToggleGroupItem>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Medium (5-7%)</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ToggleGroupItem value="high" aria-label="High ABV (7%+)">
                        <SignalHigh className="h-4 w-4" />
                      </ToggleGroupItem>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>High (7%+)</p>
                    </TooltipContent>
                  </Tooltip>
                </ToggleGroup>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Using Homepage Beer Card Style */}
        <div className="lg:col-span-3">
          {/* Beer Grid */}
          {filteredBeers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" suppressHydrationWarning>
              {filteredBeers.map((beer, index) => (
                <BeerCard
                  key={`${beer.variant}-${index}`}
                  beer={beer}
                  variant="minimal"
                  showLocation={false}
                />
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  No beers found matching your filters.
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}