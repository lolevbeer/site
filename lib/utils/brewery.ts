/**
 * Beer type to badge color mapping
 */
export const beerTypeBadges = {
  lager: "beer-badge-light",
  "light lager": "beer-badge-light",
  pilsner: "beer-badge-light",
  wheat: "beer-badge-light",
  "pale ale": "beer-badge-golden",
  ipa: "beer-badge-golden",
  "india pale ale": "beer-badge-golden",
  amber: "beer-badge-amber",
  "amber ale": "beer-badge-amber",
  "red ale": "beer-badge-amber",
  brown: "beer-badge-brown",
  "brown ale": "beer-badge-brown",
  porter: "beer-badge-dark",
  stout: "beer-badge-dark",
  "imperial stout": "beer-badge-dark",
  sour: "beer-badge-golden",
  saison: "beer-badge-golden",
  gose: "beer-badge-light",
  "fruit beer": "beer-badge-amber",
} as const;

/**
 * Get badge class for beer type
 */
export function getBeerBadgeClass(beerType: string): string {
  const normalizedType = beerType.toLowerCase() as keyof typeof beerTypeBadges;
  return beerTypeBadges[normalizedType] || "beer-badge-amber";
}

/**
 * Format ABV percentage
 */
export function formatABV(abv: number): string {
  return `${abv.toFixed(1)}% ABV`;
}

/**
 * Format IBU (International Bitterness Units)
 */
export function formatIBU(ibu: number): string {
  return `${Math.round(ibu)} IBU`;
}

/**
 * Format SRM (Standard Reference Method) color
 */
export function formatSRM(srm: number): string {
  return `${Math.round(srm)} SRM`;
}

/**
 * Get beer color description from SRM value
 */
export function getBeerColorDescription(srm: number): string {
  if (srm <= 3) return "Pale Straw";
  if (srm <= 6) return "Straw";
  if (srm <= 9) return "Pale Gold";
  if (srm <= 14) return "Deep Gold";
  if (srm <= 17) return "Pale Amber";
  if (srm <= 20) return "Medium Amber";
  if (srm <= 24) return "Deep Amber";
  if (srm <= 29) return "Amber Brown";
  if (srm <= 35) return "Brown";
  if (srm <= 40) return "Dark Brown";
  return "Black";
}

/**
 * Get beer style category
 */
export function getBeerStyleCategory(style: string): string {
  const lowerStyle = style.toLowerCase();

  if (lowerStyle.includes("lager") || lowerStyle.includes("pilsner")) {
    return "Lager";
  }
  if (lowerStyle.includes("ipa") || lowerStyle.includes("pale ale")) {
    return "IPA & Pale Ales";
  }
  if (lowerStyle.includes("wheat") || lowerStyle.includes("wit")) {
    return "Wheat Beers";
  }
  if (lowerStyle.includes("stout") || lowerStyle.includes("porter")) {
    return "Dark Ales";
  }
  if (lowerStyle.includes("sour") || lowerStyle.includes("gose")) {
    return "Sour & Wild";
  }
  if (lowerStyle.includes("saison") || lowerStyle.includes("farmhouse")) {
    return "Farmhouse";
  }

  return "Specialty";
}

/**
 * Calculate beer strength description from ABV
 */
export function getBeerStrength(abv: number): string {
  if (abv < 3.5) return "Light";
  if (abv < 5.5) return "Session";
  if (abv < 7.5) return "Standard";
  if (abv < 10) return "Strong";
  return "Imperial";
}

/**
 * Calculate bitterness description from IBU
 */
export function getBitternessDescription(ibu: number): string {
  if (ibu < 20) return "Mild";
  if (ibu < 35) return "Balanced";
  if (ibu < 50) return "Hoppy";
  if (ibu < 70) return "Bitter";
  return "Very Bitter";
}

/**
 * Brewery-specific responsive image sizes
 */
export const breweryImageSizes = {
  hero: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  card: "(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw",
  thumbnail: "(max-width: 640px) 50vw, (max-width: 768px) 33vw, 200px",
  logo: "200px",
} as const;

/**
 * Common brewery grid layouts
 */
export const breweryLayouts = {
  beerGrid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
  featureGrid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8",
  heroGrid: "grid grid-cols-1 lg:grid-cols-2 gap-12 items-center",
  statsGrid: "grid grid-cols-2 md:grid-cols-4 gap-6",
} as const;

/**
 * Animation delay utilities for staggered animations
 */
export function getStaggerDelay(index: number, baseDelay = 0.1): string {
  return `${baseDelay * index}s`;
}

/**
 * Generate brewery-themed gradient backgrounds
 */
export const breweryGradients = {
  primary: "bg-gradient-to-br from-brewery-primary/20 to-brewery-secondary/20",
  accent: "bg-gradient-to-br from-brewery-accent/20 to-beer-golden/20",
  dark: "bg-gradient-to-br from-brewery-dark/90 to-brewery-dark",
  beer: "bg-gradient-to-br from-beer-amber/20 to-beer-golden/20",
} as const;