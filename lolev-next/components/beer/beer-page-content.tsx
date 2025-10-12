/**
 * Beer Page Content Component
 * Client component for interactive beer listing functionality
 */

'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Beer } from '@/lib/types/beer';
import type { LocationFilter } from '@/lib/types/location';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X, ChevronDown, ArrowUpDown, SignalLow, SignalMedium, SignalHigh, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useLocationContext } from '@/components/location/location-provider';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';

interface BeerPageContentProps {
  beers: Beer[];
}

type SortOption = 'name' | 'abv-asc' | 'abv-desc' | 'type';

type ABVLevel = 'low' | 'medium' | 'high';

export function BeerPageContent({ beers }: BeerPageContentProps) {
  const { currentLocation } = useLocationContext();
  // Cast to LocationFilter to allow comparison with 'all'
  const locationFilter = currentLocation as LocationFilter;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [abvLevels, setAbvLevels] = useState<ABVLevel[]>([]);
  const [showOnTap, setShowOnTap] = useState(true);
  const [showInCans, setShowInCans] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [showFilters, setShowFilters] = useState(false);

  // Filter beers by location first
  const locationFilteredBeers = useMemo(() => {
    if (locationFilter === 'all') {
      return beers;
    }

    // If both availability filters are disabled, show all beers (no availability filtering)
    if (!showOnTap && !showInCans) {
      return beers;
    }

    return beers.filter(beer => {
      // Check if beer is available at current location (on tap or in cans)
      return beer.availability?.[locationFilter]?.tap ||
             beer.availability?.[locationFilter]?.cansAvailable;
    });
  }, [beers, locationFilter, showOnTap, showInCans]);

  // ABV level ranges
  const getABVRange = (level: ABVLevel): [number, number] => {
    switch (level) {
      case 'low':
        return [0, 5];
      case 'medium':
        return [5, 7];
      case 'high':
        return [7, 15];
    }
  };

  const handleABVLevelsChange = (values: string[]) => {
    setAbvLevels(values as ABVLevel[]);
  };

  // Get unique beer types based on current filters (excluding type filter itself)
  const beerTypes = useMemo(() => {
    const types = new Set<string>();

    // Filter beers by current filters (excluding type)
    const filtered = locationFilteredBeers.filter(beer => {
      // Search filter
      if (searchTerm && !beer.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !beer.description?.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !beer.type?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // ABV filter
      if (abvLevels.length > 0) {
        const matchesAnyLevel = abvLevels.some(level => {
          const [min, max] = getABVRange(level);
          return beer.abv >= min && beer.abv < max;
        });
        if (!matchesAnyLevel) {
          return false;
        }
      }

      // Availability filter
      const hasAvailabilityFilter = showOnTap || showInCans;
      if (hasAvailabilityFilter) {
        // Check location-specific availability if a location is selected
        const availability = locationFilter !== 'all'
          ? beer.availability?.[locationFilter]
          : beer.availability;

        const matchesOnTap = showOnTap && availability?.tap;
        const matchesInCans = showInCans && availability?.cansAvailable;
        if (!matchesOnTap && !matchesInCans) {
          return false;
        }
      }

      return true;
    });

    // Extract unique types from filtered beers
    filtered.forEach(beer => {
      if (beer.type) types.add(beer.type);
    });

    return Array.from(types).sort();
  }, [locationFilteredBeers, searchTerm, abvLevels, showOnTap, showInCans, locationFilter]);

  // Reset selected type if it's no longer available in filtered types
  React.useEffect(() => {
    if (selectedType !== 'all' && !beerTypes.includes(selectedType)) {
      setSelectedType('all');
    }
  }, [beerTypes, selectedType]);

  // Filter and sort beers
  const filteredBeers = useMemo(() => {
    let filtered = locationFilteredBeers.filter(beer => {
      // Search filter
      if (searchTerm && !beer.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !beer.description?.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !beer.type?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Type filter
      if (selectedType !== 'all' && beer.type !== selectedType) {
        return false;
      }

      // ABV filter - if levels selected, check if beer matches any level
      if (abvLevels.length > 0) {
        const matchesAnyLevel = abvLevels.some(level => {
          const [min, max] = getABVRange(level);
          return beer.abv >= min && beer.abv < max;
        });
        if (!matchesAnyLevel) {
          return false;
        }
      }

      // Availability filter - show beers that match ANY enabled availability option
      const hasAvailabilityFilter = showOnTap || showInCans;
      if (hasAvailabilityFilter) {
        // Check location-specific availability if a location is selected
        const availability = locationFilter !== 'all'
          ? beer.availability?.[locationFilter]
          : beer.availability;

        const matchesOnTap = showOnTap && availability?.tap;
        const matchesInCans = showInCans && availability?.cansAvailable;

        // If neither condition matches, filter out the beer
        if (!matchesOnTap && !matchesInCans) {
          return false;
        }
      }

      return true;
    });

    // Sort
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
  }, [locationFilteredBeers, searchTerm, selectedType, abvLevels, showOnTap, showInCans, sortBy, locationFilter]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedType('all');
    setAbvLevels([]);
    setShowOnTap(true);
    setShowInCans(true);
    setSortBy('name');
  };

  const activeFilterCount = [
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
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount}
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
        <Card className="lg:hidden mb-6 border-0 shadow-none dark:bg-transparent">
          <CardHeader className="p-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Filters</CardTitle>
                <span className="text-sm text-muted-foreground">
                  {filteredBeers.length} {filteredBeers.length === 1 ? 'beer' : 'beers'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 bg-secondary"
              />
            </div>

            {/* Mobile type filter */}
            <Select value={selectedType} onValueChange={setSelectedType}>
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
            <div>
              <Label className="text-sm mb-2 block">Alc by Volume</Label>
              <ToggleGroup
                type="multiple"
                variant="outline"
                value={abvLevels}
                onValueChange={handleABVLevelsChange}
                className="justify-start"
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
          <Card className="border-0 shadow-none dark:bg-transparent">
            <CardHeader className="pl-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle>Filters</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {filteredBeers.length} {filteredBeers.length === 1 ? 'beer' : 'beers'}
                  </span>
                </div>
                {activeFilterCount > 0 && (
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
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 bg-secondary"
                  />
                </div>
              </div>

              {/* Type Filter */}
              <div>
                <Select value={selectedType} onValueChange={setSelectedType}>
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
              <div className="space-y-3">
                <Label>Alc by Volume</Label>
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  value={abvLevels}
                  onValueChange={handleABVLevelsChange}
                  className="justify-start"
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
                <Link key={`${beer.variant}-${index}`} href={`/beer/${beer.variant.toLowerCase()}`} className="group">
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col border-0 h-full cursor-pointer bg-[var(--color-card-interactive)]">
                    <div className={`relative h-48 w-full flex-shrink-0 ${beer.image ? 'bg-gradient-to-b from-muted/5 to-background/20' : ''}`}>
                      {beer.image ? (
                        <Image
                          src={`/images/beer/${beer.variant.toLowerCase()}.webp`}
                          alt={beer.name}
                          fill
                          className="object-contain p-4"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                          onError={(e) => {
                            e.currentTarget.parentElement!.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center px-4">
                            <div className="text-2xl font-bold text-muted-foreground/30 mb-2">
                              {beer.name}
                            </div>
                            <div className="text-sm text-muted-foreground/30">
                              {beer.type}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4 flex flex-col flex-grow">
                      <div className="flex-grow">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold">{beer.name}</h3>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div>{beer.type}</div>
                          <div>{beer.abv}% ABV</div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Button variant="ghost" size="sm" className="w-full pointer-events-none">
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
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