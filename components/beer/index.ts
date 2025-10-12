/**
 * Beer Components - Export Index
 * Centralized exports for all beer-related components
 */

export { BeerCard } from './beer-card';
export { BeerGrid } from './beer-grid';
export { BeerFilters } from './beer-filters';
export { BeerDetails } from './beer-details';

// Re-export types for convenience
export type {
  Beer,
  BeerFilters as BeerFiltersType,
  BeerSortOptions,
  BeerStyle,
  GlassType,
} from '@/lib/types/beer';