/**
 * Beer type definitions for the brewery website
 */

/**
 * Enum for beer glass types used for serving
 */
export enum GlassType {
  PINT = 'pint',
  TEKU = 'teku',
  STEIN = 'stein',
}

/**
 * Enum for beer types/styles
 */
export enum BeerStyle {
  PALE_ALE = 'Pale Ale',
  INDIA_PALE_ALE = 'India Pale Ale',
  DOUBLE_IPA = 'Double IPA',
  SESSION_IPA = 'Session IPA',
  IMPERIAL_STOUT = 'Imperial Stout',
  BOCK = 'Bock',
  SPARKLING_HOP_WATER = 'Sparkling Hop Water',
  KOLSCH = 'Kölsch',
  SAISON = 'Saison',
  GRISETTE = 'Grisette',
  SCOTCH_ALE = 'Scotch Ale',
  DRY_IRISH_STOUT = 'Dry Irish Stout',
  UNFILTERED_PILSNER = 'Unfiltered Pilsner',
  CREAM_ALE = 'Cream Ale',
  VIENNA_LAGER = 'Vienna Lager',
  GOSE = 'Gose',
  MATCHA_ALE = 'Matcha Ale',
  CZECH_DARK_LAGER = 'Czech Dark Lager',
  MARZEN = 'Märzen',
  MEXICAN_LAGER = 'Mexican Lager',
  PILSNER = 'Pilsner',
}

/**
 * Beer pricing information
 */
export interface BeerPricing {
  draftPrice?: number;
  canSingle?: number;
  fourPack?: number;
  cansSingle?: number;
  salePrice?: boolean;
}

/**
 * Location-specific beer availability
 */
export interface LocationBeerAvailability {
  tap?: string;
  cansAvailable?: boolean;
  singleCanAvailable?: boolean;
}

/**
 * Beer availability information
 */
export interface BeerAvailability extends Record<string, LocationBeerAvailability | boolean | string | undefined> {
  cansAvailable?: boolean;
  singleCanAvailable?: boolean;
  hideFromSite?: boolean;
  tap?: string;
}

/**
 * Helper to safely get location availability
 */
export function getLocationAvailability(availability: BeerAvailability | undefined, locationSlug: string): LocationBeerAvailability | undefined {
  if (!availability) return undefined;
  const value = availability[locationSlug];
  if (value && typeof value === 'object' && ('tap' in value || 'cansAvailable' in value)) {
    return value as LocationBeerAvailability;
  }
  return undefined;
}

/**
 * Main beer interface representing all beer properties
 */
export interface Beer {
  id?: string;
  variant: string;
  name: string;
  type: BeerStyle | string;
  options?: string;
  abv: number;
  glass: GlassType;
  description: string;
  upc?: string;
  glutenFree: boolean;
  image: boolean;
  untappd?: number;
  recipe?: number;
  hops?: string;
  isJustReleased?: boolean;
  pricing: BeerPricing;
  availability: BeerAvailability;
}

/**
 * Draft beer specific interface for tap list
 */
export interface DraftBeer extends Beer {
  tap: string;
  price: string;
}

/**
 * Canned beer specific interface
 */
export interface CannedBeer extends Beer {
  cansAvailable: boolean;
  cansSingle: string;
  fourPack: string;
}

/**
 * Beer filtering options
 */
export interface BeerFilters {
  style?: BeerStyle[];
  abvRange?: { min: number; max: number };
  availability?: 'draft' | 'cans' | 'all';
  glutenFree?: boolean;
  search?: string;
}

/**
 * Beer sorting options
 */
export type BeerSortBy = 'name' | 'abv' | 'type' | 'tap';
export type BeerSortOrder = 'asc' | 'desc';

export interface BeerSortOptions {
  sortBy: BeerSortBy;
  order: BeerSortOrder;
}
