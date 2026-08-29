/**
 * Beer Page Content Component
 * Client component for interactive beer listing with inline filters.
 * Uses nuqs for URL-based filter persistence (shareable/bookmarkable).
 */

'use client'

import React, { useMemo } from 'react'
import { useQueryState, parseAsString } from 'nuqs'
import { Beer } from '@/lib/types/beer'
import { BeerCard } from '@/components/beer/beer-card'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty'
import { Search, X, Beer as BeerIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { LocationTabs } from '@/components/location/location-tabs'
import { useLocationContext } from '@/components/location/location-provider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { AVAILABILITY_OPTIONS, DEFAULT_AVAILABILITY } from '@/lib/config/beer-filters'
import { StaggerChildren, StaggerItem } from '@/components/motion'
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs'
import { PageTransition } from '@/components/motion'

interface BeerPageContentProps {
  beers: Beer[]
}

export function BeerPageContent({ beers }: BeerPageContentProps) {
  const { currentLocation } = useLocationContext()
  const [search, setSearch] = useQueryState('q', { defaultValue: '' })
  const [availability, setAvailability] = useQueryState(
    'avail',
    parseAsString.withDefault(DEFAULT_AVAILABILITY),
  )
  const [selectedType, setSelectedType] = useQueryState('style', { defaultValue: 'all' })
  const [selectedTag, setSelectedTag] = useQueryState('tag', { defaultValue: 'all' })

  const beerTypes = useMemo(() => {
    const types = new Set<string>()
    beers.forEach((beer) => {
      if (beer.type) types.add(beer.type)
    })
    return Array.from(types).sort()
  }, [beers])

  const beerTags = useMemo(() => {
    const tags = new Set<string>()
    beers.forEach((beer) => {
      if (beer.tag) tags.add(beer.tag)
    })
    return Array.from(tags).sort()
  }, [beers])

  // Writing null resets a param to its default and drops it from the URL.
  const handleSearchChange = (value: string) => setSearch(value || null)
  const handleAvailabilityChange = (value: string) =>
    setAvailability(value === DEFAULT_AVAILABILITY ? null : value)
  const handleTypeChange = (type: string) => setSelectedType(type === 'all' ? null : type)
  const handleTagChange = (tag: string) => setSelectedTag(tag === 'all' ? null : tag)

  const clearFilters = () => {
    setSearch(null)
    setAvailability(null)
    setSelectedType(null)
    setSelectedTag(null)
  }

  const hasActiveFilters =
    search ||
    availability !== DEFAULT_AVAILABILITY ||
    selectedType !== 'all' ||
    selectedTag !== 'all'

  const filteredBeers = useMemo(() => {
    const searchLower = search.toLowerCase()
    const availabilityField =
      availability === 'tap' ? 'tap' : availability === 'cans' ? 'cansAvailable' : null

    const filtered = beers.filter((beer) => {
      if (
        searchLower &&
        !beer.name.toLowerCase().includes(searchLower) &&
        !beer.description?.toLowerCase().includes(searchLower) &&
        !beer.type?.toLowerCase().includes(searchLower)
      ) {
        return false
      }
      if (selectedType && selectedType !== 'all' && beer.type !== selectedType) return false
      if (selectedTag && selectedTag !== 'all' && beer.tag !== selectedTag) return false
      if (availabilityField) {
        const locationAvailability = beer.availability?.[currentLocation]
        if (typeof locationAvailability !== 'object' || !locationAvailability[availabilityField]) {
          return false
        }
      }
      return true
    })

    // Sort by recipe number descending, beers without recipe go last
    filtered.sort((a, b) => {
      const recipeA = a.recipe ?? -Infinity
      const recipeB = b.recipe ?? -Infinity
      return recipeB - recipeA
    })

    return filtered
  }, [beers, search, selectedType, selectedTag, availability, currentLocation])

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8">
        <PageBreadcrumbs className="mb-6" />

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Our Beers</h1>
        </div>

        {/* Filter Bar */}
        <section aria-label="Beer filters" className="sticky top-16 z-20 glass rounded-lg p-3 mb-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search beers"
                placeholder="Search beers"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="bg-background pl-9 pr-9"
              />
              {search && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  type="button"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:flex-nowrap">
              <LocationTabs className="w-full sm:w-auto" />

              <SegmentedControl
                aria-label="Filter by availability"
                className="w-full sm:w-auto"
                onValueChange={handleAvailabilityChange}
                options={AVAILABILITY_OPTIONS}
                value={availability}
              />

              <Select value={selectedType} onValueChange={handleTypeChange}>
                <SelectTrigger
                  aria-label="Filter by beer style"
                  className="w-full bg-background sm:w-44"
                >
                  <SelectValue placeholder="All Styles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Styles</SelectItem>
                  {beerTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {beerTags.length > 0 && (
                <Select value={selectedTag} onValueChange={handleTagChange}>
                  <SelectTrigger
                    aria-label="Filter by beer series"
                    className="w-full bg-background sm:w-44"
                  >
                    <SelectValue placeholder="All Series" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Series</SelectItem>
                    {beerTags.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </section>

        {/* Beer Grid - Full width */}
        {filteredBeers.length > 0 ? (
          <StaggerChildren
            inView
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
          >
            {filteredBeers.map((beer, index) => (
              <StaggerItem key={`${beer.variant}-${index}`}>
                <BeerCard beer={beer} variant="minimal" showLocation={false} />
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
  )
}
