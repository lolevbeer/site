/**
 * Menu schema generation for brewery tap list and cans menu
 * Helps with "what's on tap" and menu-related searches
 * @see https://schema.org/Menu
 * @see https://schema.org/MenuItem
 */

import { Beer } from '@/lib/types/beer';

export interface MenuItemJsonLd {
  '@type': 'MenuItem';
  name: string;
  description?: string;
  offers?: {
    '@type': 'Offer';
    price: string;
    priceCurrency: string;
  };
  nutrition?: {
    '@type': 'NutritionInformation';
    alcoholContent?: string;
  };
  suitableForDiet?: string[];
}

export interface MenuSectionJsonLd {
  '@type': 'MenuSection';
  name: string;
  description?: string;
  hasMenuItem: MenuItemJsonLd[];
}

export interface MenuJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Menu';
  name: string;
  description?: string;
  url?: string;
  hasMenuSection?: MenuSectionJsonLd[];
  hasMenuItem?: MenuItemJsonLd[];
  inLanguage?: string;
  mainEntityOfPage?: string;
}

/**
 * Get style name from beer
 */
function getBeerStyleName(beer: Beer & { style?: unknown }): string {
  if (beer.type && typeof beer.type === 'string') {
    return beer.type;
  }
  if (beer.style) {
    if (typeof beer.style === 'string') return beer.style;
    if (typeof beer.style === 'object' && beer.style !== null && 'name' in beer.style) {
      return (beer.style as { name: string }).name;
    }
  }
  return 'Beer';
}

/**
 * Convert a beer to a MenuItem
 */
function beerToMenuItem(beer: Beer & { style?: unknown; draftPrice?: number; fourPack?: number }): MenuItemJsonLd {
  const styleName = getBeerStyleName(beer);
  const draftPrice = beer.draftPrice || beer.pricing?.draftPrice;

  const menuItem: MenuItemJsonLd = {
    '@type': 'MenuItem',
    name: beer.name,
    description: beer.description || `${styleName} - ${beer.abv}% ABV`,
  };

  if (draftPrice) {
    menuItem.offers = {
      '@type': 'Offer',
      price: draftPrice.toString(),
      priceCurrency: 'USD',
    };
  }

  if (beer.abv) {
    menuItem.nutrition = {
      '@type': 'NutritionInformation',
      alcoholContent: `${beer.abv}% ABV`,
    };
  }

  if (beer.glutenFree) {
    menuItem.suitableForDiet = ['https://schema.org/GlutenFreeDiet'];
  }

  return menuItem;
}

/**
 * Generate Menu schema for draft beers (tap list)
 */
export function generateDraftMenuSchema(
  beers: (Beer & { style?: unknown; draftPrice?: number })[],
  locationName?: string
): MenuJsonLd {
  const baseUrl = 'https://lolev.beer';
  const menuName = locationName
    ? `Lolev Beer ${locationName} Draft Menu`
    : 'Lolev Beer Draft Menu';

  // Filter to only beers on tap
  const draftBeers = beers.filter(beer => beer.availability?.tap);

  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: menuName,
    description: 'Current draft beers on tap at Lolev Beer. Our rotating selection of craft beers brewed in-house.',
    url: baseUrl,
    inLanguage: 'en-US',
    hasMenuSection: [
      {
        '@type': 'MenuSection',
        name: 'On Tap',
        description: 'Draft beers currently pouring',
        hasMenuItem: draftBeers.map(beerToMenuItem),
      },
    ],
  };
}

/**
 * Generate Menu schema for canned beers
 */
export function generateCansMenuSchema(
  beers: (Beer & { style?: unknown; fourPack?: number })[],
  locationName?: string
): MenuJsonLd {
  const baseUrl = 'https://lolev.beer';
  const menuName = locationName
    ? `Lolev Beer ${locationName} Cans Menu`
    : 'Lolev Beer Cans Menu';

  // Filter to only beers available in cans
  const cannedBeers = beers.filter(beer => beer.availability?.cansAvailable);

  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: menuName,
    description: 'Canned beers available to-go at Lolev Beer.',
    url: `${baseUrl}/beer`,
    inLanguage: 'en-US',
    hasMenuSection: [
      {
        '@type': 'MenuSection',
        name: 'Cans To-Go',
        description: 'Beers available in cans',
        hasMenuItem: cannedBeers.map(beer => {
          const fourPackPrice = beer.fourPack || beer.pricing?.fourPack;
          const menuItem = beerToMenuItem(beer);
          if (fourPackPrice) {
            menuItem.offers = {
              '@type': 'Offer',
              price: fourPackPrice.toString(),
              priceCurrency: 'USD',
            };
          }
          return menuItem;
        }),
      },
    ],
  };
}

/**
 * Generate combined Menu schema with both draft and cans
 */
export function generateFullMenuSchema(
  beers: (Beer & { style?: unknown; draftPrice?: number; fourPack?: number })[],
  locationName?: string
): MenuJsonLd {
  const baseUrl = 'https://lolev.beer';
  const menuName = locationName
    ? `Lolev Beer ${locationName} Menu`
    : 'Lolev Beer Menu';

  const draftBeers = beers.filter(beer => beer.availability?.tap);
  const cannedBeers = beers.filter(beer => beer.availability?.cansAvailable);

  const sections: MenuSectionJsonLd[] = [];

  if (draftBeers.length > 0) {
    sections.push({
      '@type': 'MenuSection',
      name: 'On Tap',
      description: 'Draft beers currently pouring',
      hasMenuItem: draftBeers.map(beerToMenuItem),
    });
  }

  if (cannedBeers.length > 0) {
    sections.push({
      '@type': 'MenuSection',
      name: 'Cans To-Go',
      description: 'Beers available in cans',
      hasMenuItem: cannedBeers.map(beer => {
        const fourPackPrice = beer.fourPack || beer.pricing?.fourPack;
        const menuItem = beerToMenuItem(beer);
        if (fourPackPrice) {
          menuItem.offers = {
            '@type': 'Offer',
            price: fourPackPrice.toString(),
            priceCurrency: 'USD',
          };
        }
        return menuItem;
      }),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: menuName,
    description: 'Full beer menu at Lolev Beer including draft and canned options.',
    url: baseUrl,
    inLanguage: 'en-US',
    mainEntityOfPage: baseUrl,
    hasMenuSection: sections,
  };
}
