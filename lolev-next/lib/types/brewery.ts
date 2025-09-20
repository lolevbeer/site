/**
 * Brewery theme type definitions
 */

export interface BeerSpecs {
  abv: number;
  ibu: number;
  srm: number;
  og?: number; // Original Gravity
  fg?: number; // Final Gravity
}

export interface Beer {
  id: string;
  name: string;
  style: string;
  description: string;
  specs: BeerSpecs;
  image?: string;
  availability: "year-round" | "seasonal" | "limited" | "draft-only";
  tags: string[];
  ingredients?: {
    malts: string[];
    hops: string[];
    yeast: string;
    adjuncts?: string[];
  };
}

export interface BreweryInfo {
  name: string;
  tagline: string;
  description: string;
  founded: number;
  location: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  contact: {
    phone: string;
    email: string;
    website: string;
  };
  socialMedia: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    untappd?: string;
  };
}

export interface SellSheetData {
  beer: Beer;
  brewery: BreweryInfo;
  awards?: Array<{
    name: string;
    year: number;
    organization: string;
  }>;
  distribution?: {
    states: string[];
    distributors: string[];
  };
  packaging?: {
    formats: string[];
    sizes: string[];
  };
}

/**
 * Beer type categories for styling
 */
export type BeerType =
  | "lager"
  | "light lager"
  | "pilsner"
  | "wheat"
  | "pale ale"
  | "ipa"
  | "india pale ale"
  | "amber"
  | "amber ale"
  | "red ale"
  | "brown"
  | "brown ale"
  | "porter"
  | "stout"
  | "imperial stout"
  | "sour"
  | "saison"
  | "gose"
  | "fruit beer";

/**
 * Beer availability types
 */
export type BeerAvailability = "year-round" | "seasonal" | "limited" | "draft-only";

/**
 * Brewery color scheme
 */
export interface BreweryColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  dark: string;
}

/**
 * Beer color palette
 */
export interface BeerColors {
  light: string;
  amber: string;
  brown: string;
  dark: string;
  golden: string;
}

/**
 * Layout configurations
 */
export type BreweryLayout = "beerGrid" | "featureGrid" | "heroGrid" | "statsGrid";

/**
 * Image size configurations
 */
export type BreweryImageSize = "hero" | "card" | "thumbnail" | "logo";

/**
 * Animation types
 */
export type BreweryAnimation = "fade-in" | "slide-up" | "float";

/**
 * Component variants
 */
export interface BreweryComponentVariants {
  button: "primary" | "secondary" | "accent";
  badge: "light" | "amber" | "brown" | "dark" | "golden";
  card: "default" | "featured" | "compact";
}

/**
 * Theme configuration
 */
export interface BreweryTheme {
  colors: BreweryColors & { beer: BeerColors };
  fonts: {
    heading: string;
    body: string;
  };
  animations: {
    duration: string;
    easing: string;
  };
  spacing: {
    section: string;
    card: string;
  };
  borderRadius: {
    card: string;
    button: string;
  };
}

/**
 * Filter options for beer listings
 */
export interface BeerFilters {
  style?: string[];
  availability?: BeerAvailability[];
  abvRange?: [number, number];
  ibuRange?: [number, number];
  tags?: string[];
}

/**
 * Sort options for beer listings
 */
export type BeerSortOption =
  | "name-asc"
  | "name-desc"
  | "abv-asc"
  | "abv-desc"
  | "ibu-asc"
  | "ibu-desc"
  | "style-asc"
  | "style-desc";

/**
 * Responsive breakpoints
 */
export interface BreweryBreakpoints {
  mobile: string;
  tablet: string;
  desktop: string;
  wide: string;
}