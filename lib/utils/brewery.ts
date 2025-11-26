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

// formatABV removed - use formatAbv(abv, true) from formatters.ts instead

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
 * Brewery-specific responsive image sizes
 */
export const breweryImageSizes = {
  hero: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  card: "(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw",
  thumbnail: "(max-width: 640px) 50vw, (max-width: 768px) 33vw, 200px",
  logo: "200px",
} as const;