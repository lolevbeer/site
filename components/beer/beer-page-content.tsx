/**
 * Beer Page Content Component
 * Client component for interactive beer listing functionality
 * Uses nuqs for URL-based filter persistence (shareable/bookmarkable filters)
 */

'use client';

import React, { useMemo, useCallback } from 'react';
import { useQueryState, parseAsString, parseAsArrayOf, parseAsBoolean } from 'nuqs';
import { Beer } from '@/lib/types/beer';
import { BeerCard } from '@/components/beer/beer-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, ChevronDown, ArrowUpDown, SignalLow, SignalMedium, SignalHigh, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { ABV_LEVELS } from '@/lib/constants/beer-filters';
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

type _SortOption = 'name' | 'abv-asc' | 'abv-desc' | 'type' | 'recipe';

// nuqs parsers for URL state
const abvLevelsParser = parseAsArrayOf(parseAsString);

export function BeerPageContent({ beers }: BeerPageContentProps) {
  // URL-synced filter state using nuqs (shareable/bookmarkable)
  const [search, setSearch] = useQueryState('q', { defaultValue: '' });
  const [selectedType, setSelectedType] = useQueryState('style', { defaultValue: 'all' });
  const [abvLevels, setAbvLevels] = useQueryState('abv', abvLevelsParser.withDefault([]));
  const [showOnTap, setShowOnTap] = useQueryState('tap', parseAsBoolean.withDefault(true));
  const [showInCans, setShowInCans] = useQueryState('cans', parseAsBoolean.withDefault(true));
  const [sortBy, setSortBy] = useQueryState('sort', parseAsString.withDefault('recipe'));

  // Local UI state (not in URL)
  const [showFilters, setShowFilters] = React.useState(false);

  // Get unique beer types from all beers
  const beerTypes = useMemo(() => {
    const types = new Set<string>();
    beers.forEach(beer => {
      if (beer.type) types.add(beer.type);
    });
    return Array.from(types).sort();
  }, [beers]);

  // Handle ABV level changes
  const handleABVLevelsChange = useCallback((values: string[]) => {
    setAbvLevels(values.length > 0 ? values : null);
  }, [setAbvLevels]);

  // Handle search changes
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value || null);
  }, [setSearch]);

  // Handle type filter changes
  const handleTypeChange = useCallback((type: string) => {
    setSelectedType(type === 'all' ? null : type);
  }, [setSelectedType]);

  // Calculate ABV range from selected levels
  const abvRange = useMemo(() => {
    if (abvLevels.length === 0) return undefined;

    const ranges = abvLevels.map(level => {
      const levelData = Object.values(ABV_LEVELS).find(l => l.value === level);
      return levelData ? { min: levelData.min, max: levelData.max } : null;
    }).filter(Boolean) as { min: number; max: number }[];

    if (ranges.length === 0) return undefined;

    return {
      min: Math.min(...ranges.map(r => r.min)),
      max: Math.max(...ranges.map(r => r.max))
    };
  }, [abvLevels]);

  // Apply all filters and sorting
  const filteredBeers = useMemo(() => {
    let filtered = [...beers];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        beer =>
          beer.name.toLowerCase().includes(searchLower) ||
          beer.description?.toLowerCase().includes(searchLower) ||
          beer.type?.toLowerCase().includes(searchLower)
      );
    }

    // Style filter
    if (selectedType && selectedType !== 'all') {
      filtered = filtered.filter(beer => beer.type === selectedType);
    }

    // ABV range filter
    if (abvRange) {
      filtered = filtered.filter(
        beer => beer.abv >= abvRange.min && beer.abv <= abvRange.max
      );
    }

    // Apply availability toggle filters (on tap / in cans)
    if (showOnTap || showInCans) {
      filtered = filtered.filter(beer => {
        // Check tap availability - either top-level or at any location
        const isOnTapAnywhere = !!(
          beer.availability?.tap ||
          Object.values(beer.availability || {}).some(
            val => typeof val === 'object' && val !== null && 'tap' in val && val.tap
          )
        );
        // Check cans availability - either top-level or at any location
        const isInCansAnywhere = !!(
          beer.availability?.cansAvailable ||
          Object.values(beer.availability || {}).some(
            val => typeof val === 'object' && val !== null && 'cansAvailable' in val && val.cansAvailable
          )
        );

        const matchesOnTap = showOnTap && isOnTapAnywhere;
        const matchesInCans = showInCans && isInCansAnywhere;

        return matchesOnTap || matchesInCans;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'abv-asc':
          return a.abv - b.abv;
        case 'abv-desc':
          return b.abv - a.abv;
        case 'type':
          return (a.type || '').localeCompare(b.type || '');
        case 'recipe':
          // Sort by recipe number descending, beers without recipe go last
          const recipeA = a.recipe ?? -Infinity;
          const recipeB = b.recipe ?? -Infinity;
          return recipeB - recipeA;
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [beers, search, selectedType, abvRange, showOnTap, showInCans, sortBy]);

  const clearFilters = useCallback(() => {
    setSearch(null);
    setSelectedType(null);
    setAbvLevels(null);
    setShowOnTap(null);
    setShowInCans(null);
    setSortBy(null);
  }, [setSearch, setSelectedType, setAbvLevels, setShowOnTap, setShowInCans, setSortBy]);

  const localActiveFilterCount = [
    search,
    selectedType && selectedType !== 'all',
    abvLevels.length > 0,
    !showOnTap || !showInCans,
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
        {/* Mobile Filter Toggle - Sheet */}
        <Sheet open={showFilters} onOpenChange={setShowFilters}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
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
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] p-0">
            <div className="h-full flex flex-col">
              <SheetHeader className="px-6 py-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription>
                      {filteredBeers.length} {filteredBeers.length === 1 ? 'beer' : 'beers'} found
                    </SheetDescription>
                  </div>
                  {localActiveFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                  )}
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search beers..."
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Beer Style */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Beer Style</Label>
                  <Select value={selectedType} onValueChange={handleTypeChange}>
                    <SelectTrigger className="w-full">
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

                {/* Availability */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Availability</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={showOnTap ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowOnTap(!showOnTap)}
                      className="flex-1"
                    >
                      On Tap
                    </Button>
                    <Button
                      variant={showInCans ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowInCans(!showInCans)}
                      className="flex-1"
                    >
                      In Cans
                    </Button>
                  </div>
                </div>

                {/* ABV Level */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Alcohol by Volume</Label>
                  <ToggleGroup
                    type="multiple"
                    variant="outline"
                    value={abvLevels}
                    onValueChange={handleABVLevelsChange}
                    className="grid grid-cols-3 gap-2"
                  >
                    <ToggleGroupItem value="low" aria-label="Low ABV (0-5%)" className="flex-col gap-1 h-auto py-3">
                      <SignalLow className="h-5 w-5" />
                      <span className="text-xs">Low</span>
                      <span className="text-xs text-muted-foreground">0-5%</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem value="medium" aria-label="Medium ABV (5-7%)" className="flex-col gap-1 h-auto py-3">
                      <SignalMedium className="h-5 w-5" />
                      <span className="text-xs">Medium</span>
                      <span className="text-xs text-muted-foreground">5-7%</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem value="high" aria-label="High ABV (7%+)" className="flex-col gap-1 h-auto py-3">
                      <SignalHigh className="h-5 w-5" />
                      <span className="text-xs">High</span>
                      <span className="text-xs text-muted-foreground">7%+</span>
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              <div className="border-t px-6 py-4">
                <SheetClose asChild>
                  <Button className="w-full" size="lg">
                    View {filteredBeers.length} {filteredBeers.length === 1 ? 'Beer' : 'Beers'}
                  </Button>
                </SheetClose>
              </div>
            </div>
          </SheetContent>
        </Sheet>

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
            <DropdownMenuItem
              onClick={() => setSortBy('recipe')}
              className={cn("cursor-pointer", sortBy === 'recipe' && "bg-muted")}
            >
              Recipe
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
                    value={search}
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
                <div className="text-4xl mb-4">🍺</div>
                <h3 className="text-lg font-semibold mb-2">No Beers Found</h3>
                <p className="text-muted-foreground mb-4">
                  {search && selectedType !== 'all'
                    ? `No ${selectedType} beers matching "${search}"`
                    : search
                    ? `No beers matching "${search}"`
                    : selectedType !== 'all'
                    ? `No ${selectedType} beers available with current filters`
                    : 'No beers match your current filters'}
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  Clear all filters
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}