/**
 * Beer Page Content Component
 * Client component for interactive beer listing functionality
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Beer } from '@/lib/types/beer';
import { BeerCard } from './beer-card';
import { Search, Filter, X, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface BeerPageContentProps {
  beers: Beer[];
}

type SortOption = 'name' | 'abv-asc' | 'abv-desc' | 'type';

export function BeerPageContent({ beers }: BeerPageContentProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedGlass, setSelectedGlass] = useState<string>('all');
  const [abvRange, setAbvRange] = useState<[number, number]>([0, 15]);
  const [showOnTap, setShowOnTap] = useState(false);
  const [showInCans, setShowInCans] = useState(false);
  const [showGlutenFree, setShowGlutenFree] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [showFilters, setShowFilters] = useState(false);

  // Get unique beer types and glasses
  const beerTypes = useMemo(() => {
    const types = new Set<string>();
    beers.forEach(beer => {
      if (beer.type) types.add(beer.type);
    });
    return Array.from(types).sort();
  }, [beers]);

  const glassTypes = useMemo(() => {
    const glasses = new Set<string>();
    beers.forEach(beer => {
      if (beer.glass) glasses.add(beer.glass);
    });
    return Array.from(glasses).sort();
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

      // Glass filter
      if (selectedGlass !== 'all' && beer.glass !== selectedGlass) {
        return false;
      }

      // ABV filter
      if (beer.abv < abvRange[0] || beer.abv > abvRange[1]) {
        return false;
      }

      // On tap filter
      if (showOnTap && !beer.availability?.tap) {
        return false;
      }

      // In cans filter
      if (showInCans && !beer.availability?.cansAvailable) {
        return false;
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
  }, [beers, searchTerm, selectedType, selectedGlass, abvRange, showOnTap, showInCans, showGlutenFree, sortBy]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedType('all');
    setSelectedGlass('all');
    setAbvRange([0, 15]);
    setShowOnTap(false);
    setShowInCans(false);
    setShowGlutenFree(false);
    setSortBy('name');
  };

  const activeFilterCount = [
    selectedType !== 'all',
    selectedGlass !== 'all',
    abvRange[0] !== 0 || abvRange[1] !== 15,
    showOnTap,
    showInCans,
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

              {/* Glass Filter */}
              <div className="space-y-2">
                <Label>Glass</Label>
                <Select value={selectedGlass} onValueChange={setSelectedGlass}>
                  <SelectTrigger>
                    <SelectValue placeholder="All glasses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All glasses</SelectItem>
                    {glassTypes.map(glass => (
                      <SelectItem key={glass} value={glass}>
                        {glass}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ABV Range */}
              <div className="space-y-2">
                <Label>ABV: {abvRange[0]}% - {abvRange[1]}%</Label>
                <Slider
                  min={0}
                  max={15}
                  step={0.5}
                  value={abvRange}
                  onValueChange={(value) => setAbvRange(value as [number, number])}
                  className="w-full"
                />
              </div>

              <Separator />

              {/* Availability Filters */}
              <div className="space-y-3">
                <Label>Availability</Label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOnTap}
                      onChange={(e) => setShowOnTap(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">On Tap</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showInCans}
                      onChange={(e) => setShowInCans(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">In Cans</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showGlutenFree}
                      onChange={(e) => setShowGlutenFree(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Gluten Free</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Mobile Filter Toggle & Sort */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
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

              {/* Results count */}
              <span className="text-sm text-muted-foreground">
                {filteredBeers.length} {filteredBeers.length === 1 ? 'beer' : 'beers'}
              </span>
            </div>

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="min-w-[140px]">
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

                {/* Mobile availability filters */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={showOnTap ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowOnTap(!showOnTap)}
                  >
                    On Tap
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

          {/* Beer Grid */}
          {filteredBeers.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredBeers.map((beer) => (
                <BeerCard
                  key={beer.variant}
                  beer={beer}
                  showLocation={false}
                  showPricing={true}
                  showAvailability={true}
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