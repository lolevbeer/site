/**
 * Beer type definitions for the brewery website
 * Based on CSV data schema from _data/beer.csv and related files
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
  /** Draft price per glass */
  draftPrice?: string;
  /** Single can price */
  canSingle?: string;
  /** Four-pack price */
  fourPack?: string;
  /** Single can price (alternative field name) */
  cansSingle?: string;
  /** Sale price indicator */
  salePrice?: boolean;
}

/**
 * Beer availability information
 */
export interface BeerAvailability {
  /** Whether beer is available in cans */
  cansAvailable?: boolean;
  /** Whether single cans are available */
  singleCanAvailable?: boolean;
  /** Whether beer should be hidden from the website */
  hideFromSite?: boolean;
  /** Tap number if on draft */
  tap?: string;
}

/**
 * Main beer interface representing all beer properties
 */
export interface Beer {
  /** Unique variant identifier */
  variant: string;
  /** Display name of the beer */
  name: string;
  /** Beer style/type */
  type: BeerStyle | string;
  /** Additional options or variations */
  options?: string;
  /** Alcohol by volume percentage */
  abv: number;
  /** Recommended glass type for serving */
  glass: GlassType;
  /** Beer description */
  description: string;
  /** UPC code for the product */
  upc?: string;
  /** Whether the beer is gluten-free */
  glutenFree: boolean;
  /** Whether the beer has an associated image */
  image: boolean;
  /** Untappd ID for the beer */
  untappd?: number;
  /** Recipe number or identifier */
  recipe?: number;
  /** Hops used in brewing */
  hops?: string;
  /** Pricing information */
  pricing: BeerPricing;
  /** Availability information */
  availability: BeerAvailability;
}

/**
 * Draft beer specific interface for tap list
 */
export interface DraftBeer extends Beer {
  /** Tap number */
  tap: string;
  /** Draft-specific pricing */
  price: string;
}

/**
 * Canned beer specific interface
 */
export interface CannedBeer extends Beer {
  /** Whether cans are currently available */
  cansAvailable: boolean;
  /** Single can pricing */
  cansSingle: string;
  /** Four-pack pricing */
  fourPack: string;
}

/**
 * Coming soon beer interface for upcoming releases
 */
export interface ComingBeer {
  /** Beer variant identifier */
  variant: string;
  /** Beer name */
  name: string;
  /** Beer style */
  type: BeerStyle | string;
  /** Expected release timeframe */
  expected?: string;
  /** Brief description */
  description?: string;
}

/**
 * Union type for all beer types
 */
export type AnyBeer = Beer | DraftBeer | CannedBeer | ComingBeer;

/**
 * Beer list response interface
 */
export interface BeerList {
  /** List of beers */
  beers: Beer[];
  /** Total count */
  total: number;
  /** Last updated timestamp */
  lastUpdated?: string;
}

/**
 * Beer filtering options
 */
export interface BeerFilters {
  /** Filter by beer style */
  style?: BeerStyle[];
  /** Filter by ABV range */
  abvRange?: {
    min: number;
    max: number;
  };
  /** Filter by availability */
  availability?: 'draft' | 'cans' | 'all';
  /** Filter gluten-free options */
  glutenFree?: boolean;
  /** Search by name or description */
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