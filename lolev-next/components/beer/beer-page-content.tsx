/**
 * Beer Page Content Component
 * Client component for interactive beer listing functionality
 */

'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Beer } from '@/lib/types/beer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X, ChevronDown, ArrowUpDown, SignalLow, SignalMedium, SignalHigh } from 'lucide-react';
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
import { cn } from '@/lib/utils';

interface BeerPageContentProps {
  beers: Beer[];
}

type SortOption = 'name' | 'abv-asc' | 'abv-desc' | 'type';

type ABVLevel = 'low' | 'medium' | 'high';

export function BeerPageContent({ beers }: BeerPageContentProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [abvLevels, setAbvLevels] = useState<ABVLevel[]>([]);
  const [showOnTap, setShowOnTap] = useState(true);
  const [showInCans, setShowInCans] = useState(true);
  const [showGlutenFree, setShowGlutenFree] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [showFilters, setShowFilters] = useState(false);

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

  // Get unique beer types
  const beerTypes = useMemo(() => {
    const types = new Set<string>();
    beers.forEach(beer => {
      if (beer.type) types.add(beer.type);
    });
    return Array.from(types).sort();
  }, [beers]);

  // Filter and sort beers
  const filteredBeers = useMemo(() => {
    let filtered = beers.filter(beer => {
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
        const matchesOnTap = showOnTap && beer.availability?.tap;
        const matchesInCans = showInCans && beer.availability?.cansAvailable;

        // If neither condition matches, filter out the beer
        if (!matchesOnTap && !matchesInCans) {
          return false;
        }
      }

      // Gluten free filter
      if (showGlutenFree && !beer.glutenFree) {
        return false;
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
  }, [beers, searchTerm, selectedType, abvLevels, showOnTap, showInCans, showGlutenFree, sortBy, getABVRange]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedType('all');
    setAbvLevels([]);
    setShowOnTap(true);
    setShowInCans(true);
    setShowGlutenFree(false);
    setSortBy('name');
  };

  const activeFilterCount = [
    selectedType !== 'all',
    abvLevels.length > 0,
    // Only count as active if different from defaults (both on)
    (!showOnTap || !showInCans),
    showGlutenFree,
  ].filter(Boolean).length;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Our Beers</h1>
        <p className="text-lg">
          Discover our handcrafted selection of beers, from hoppy IPAs to rich stouts.
          Each beer is brewed with care using the finest ingredients and traditional techniques.
        </p>
      </div>

      {/* Sort and Mobile Filter Controls */}
      <div className="flex items-center justify-between mb-6">
        {/* Mobile Filter Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="lg:hidden"
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
            <Button variant="outline" size="sm" className="min-w-[140px] ml-auto">
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
              className={cn("cursor-pointer", sortBy === 'name' && "bg-accent")}
            >
              Name (A-Z)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortBy('type')}
              className={cn("cursor-pointer", sortBy === 'type' && "bg-accent")}
            >
              Type
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortBy('abv-asc')}
              className={cn("cursor-pointer", sortBy === 'abv-asc' && "bg-accent")}
            >
              ABV (Low to High)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortBy('abv-desc')}
              className={cn("cursor-pointer", sortBy === 'abv-desc' && "bg-accent")}
            >
              ABV (High to Low)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile Filters */}
      {showFilters && (
        <Card className="lg:hidden mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Filters</CardTitle>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-auto p-1 text-xs"
                  >
                    Clear all
                  </Button>
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
            <div className="text-sm text-muted-foreground mt-2">
              {filteredBeers.length} {filteredBeers.length === 1 ? 'beer' : 'beers'}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mobile search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search beers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Mobile type filter */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {beerTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
                <ToggleGroupItem value="low" aria-label="Low ABV (0-5%)">
                  <SignalLow className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="medium" aria-label="Medium ABV (5-7%)">
                  <SignalMedium className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="high" aria-label="High ABV (7%+)">
                  <SignalHigh className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

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
              <Button
                variant={showGlutenFree ? "default" : "outline"}
                size="sm"
                onClick={() => setShowGlutenFree(!showGlutenFree)}
              >
                Gluten Free
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar - Desktop */}
        <div className="hidden lg:block">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-auto p-0 text-xs"
                  >
                    Clear all
                  </Button>
                )}
              </CardTitle>
              <div className="text-sm text-muted-foreground mt-2">
                {filteredBeers.length} {filteredBeers.length === 1 ? 'beer' : 'beers'}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search */}
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search beers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <Separator />

              {/* Type Filter */}
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {beerTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  <ToggleGroupItem value="low" aria-label="Low ABV (0-5%)">
                    <SignalLow className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="medium" aria-label="Medium ABV (5-7%)">
                    <SignalMedium className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="high" aria-label="High ABV (7%+)">
                    <SignalHigh className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <Separator />

              {/* Availability Filters */}
              <div className="space-y-3">
                <Label>Availability</Label>
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
                  <div className="flex items-center justify-between">
                    <label htmlFor="gluten-free" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Gluten Free
                    </label>
                    <Switch
                      id="gluten-free"
                      checked={showGlutenFree}
                      onCheckedChange={setShowGlutenFree}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Using Homepage Beer Card Style */}
        <div className="lg:col-span-3">
          {/* Beer Grid */}
          {filteredBeers.length > 0 ? (
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${filteredBeers.length === 10 ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
              {filteredBeers.map((beer, index) => (
                <Link key={`${beer.variant}-${index}`} href={`/beer/${beer.variant.toLowerCase()}`} className="group">
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col border-0 h-full cursor-pointer">
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
                          {beer.description && (
                            <div className="mt-2 text-xs line-clamp-2">{beer.description}</div>
                          )}
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