/**
 * Menu schema generation for brewery tap list and cans menu
 * Helps with "what's on tap" and menu-related searches
 * @see https://schema.org/Menu
 * @see https://schema.org/MenuItem
 */

import { LOLEV_BASE_URL, resolveStyleName } from '@/lib/utils/schema-shared'

/** Minimal beer interface for menu schema generation */
interface MenuBeer {
  name: string
  description?: string | null
  abv: number
  style?: string | { name: string } | unknown
  draftPrice?: number | null
  fourPack?: number | null
  glutenFree?: boolean | null
}

export interface MenuItemJsonLd {
  '@type': 'MenuItem'
  name: string
  description?: string
  offers?: {
    '@type': 'Offer'
    price: string
    priceCurrency: string
  }
  nutrition?: {
    '@type': 'NutritionInformation'
    alcoholContent?: string
  }
  suitableForDiet?: string[]
}

export interface MenuSectionJsonLd {
  '@type': 'MenuSection'
  name: string
  description?: string
  hasMenuItem: MenuItemJsonLd[]
}

export interface MenuJsonLd {
  '@context': 'https://schema.org'
  '@type': 'Menu'
  name: string
  description?: string
  url?: string
  hasMenuSection?: MenuSectionJsonLd[]
  hasMenuItem?: MenuItemJsonLd[]
  inLanguage?: string
  mainEntityOfPage?: string
}

/**
 * Get style name from beer
 */
function getBeerStyleName(beer: MenuBeer): string {
  return resolveStyleName(beer.style) ?? 'Beer'
}

/**
 * Build a menu title, dropping the location segment when no location is given.
 * Shared by the three generators below, which differ only in the suffix.
 */
function buildMenuName(locationName: string | undefined, suffix: string): string {
  return ['Lolev Beer', locationName, suffix].filter(Boolean).join(' ')
}

/**
 * Convert a beer to a MenuItem
 */
function beerToMenuItem(beer: MenuBeer): MenuItemJsonLd {
  const styleName = getBeerStyleName(beer)

  const menuItem: MenuItemJsonLd = {
    '@type': 'MenuItem',
    name: beer.name,
    description: beer.description || `${styleName} - ${beer.abv}% ABV`,
  }

  if (beer.draftPrice) {
    menuItem.offers = {
      '@type': 'Offer',
      price: beer.draftPrice.toString(),
      priceCurrency: 'USD',
    }
  }

  if (beer.abv) {
    menuItem.nutrition = {
      '@type': 'NutritionInformation',
      alcoholContent: `${beer.abv}% ABV`,
    }
  }

  if (beer.glutenFree) {
    menuItem.suitableForDiet = ['https://schema.org/GlutenFreeDiet']
  }

  return menuItem
}

/**
 * Convert a beer to a MenuItem priced as a four-pack rather than a pour.
 * Shared by every "Cans To-Go" section so the can pricing override stays in
 * one place.
 */
function beerToCanMenuItem(beer: MenuBeer): MenuItemJsonLd {
  const menuItem = beerToMenuItem(beer)
  if (beer.fourPack) {
    menuItem.offers = {
      '@type': 'Offer',
      price: beer.fourPack.toString(),
      priceCurrency: 'USD',
    }
  }
  return menuItem
}

/**
 * Build the "On Tap" section. Shared by the draft-only and full menus, which
 * describe the tap list identically and differ only in which beers they pass.
 */
function buildOnTapSection(beers: MenuBeer[]): MenuSectionJsonLd {
  return {
    '@type': 'MenuSection',
    name: 'On Tap',
    description: 'Draft beers currently pouring',
    hasMenuItem: beers.map(beerToMenuItem),
  }
}

/**
 * Build the "Cans To-Go" section. Shared by the cans-only and full menus for
 * the same reason as buildOnTapSection.
 */
function buildCansToGoSection(beers: MenuBeer[]): MenuSectionJsonLd {
  return {
    '@type': 'MenuSection',
    name: 'Cans To-Go',
    description: 'Beers available in cans',
    hasMenuItem: beers.map(beerToCanMenuItem),
  }
}

/**
 * Generate Menu schema for draft beers (tap list)
 */
export function generateDraftMenuSchema(beers: MenuBeer[], locationName?: string): MenuJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: buildMenuName(locationName, 'Draft Menu'),
    description:
      'Current draft beers on tap at Lolev Beer. Our rotating selection of craft beers brewed in-house.',
    url: LOLEV_BASE_URL,
    inLanguage: 'en-US',
    hasMenuSection: [buildOnTapSection(beers)],
  }
}

/**
 * Generate Menu schema for canned beers
 */
export function generateCansMenuSchema(beers: MenuBeer[], locationName?: string): MenuJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: buildMenuName(locationName, 'Cans Menu'),
    description: 'Canned beers available to-go at Lolev Beer.',
    url: `${LOLEV_BASE_URL}/beer`,
    inLanguage: 'en-US',
    hasMenuSection: [buildCansToGoSection(beers)],
  }
}

/**
 * Generate combined Menu schema with both draft and cans
 */
export function generateFullMenuSchema(beers: MenuBeer[], locationName?: string): MenuJsonLd {
  const sections: MenuSectionJsonLd[] = []

  // All beers with a draft price are on tap
  const draftBeers = beers.filter((beer) => beer.draftPrice)
  // Beers with a fourPack price are available in cans
  const cannedBeers = beers.filter((beer) => beer.fourPack)

  if (draftBeers.length > 0) {
    sections.push(buildOnTapSection(draftBeers))
  }

  if (cannedBeers.length > 0) {
    sections.push(buildCansToGoSection(cannedBeers))
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: buildMenuName(locationName, 'Menu'),
    description: 'Full beer menu at Lolev Beer including draft and canned options.',
    url: LOLEV_BASE_URL,
    inLanguage: 'en-US',
    mainEntityOfPage: LOLEV_BASE_URL,
    hasMenuSection: sections,
  }
}
