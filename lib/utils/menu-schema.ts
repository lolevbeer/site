/**
 * Menu schema generation for brewery tap list and cans menu
 * Helps with "what's on tap" and menu-related searches
 * @see https://schema.org/Menu
 * @see https://schema.org/MenuItem
 */

import { LOLEV_BASE_URL } from '@/lib/utils/schema-shared'
import { relationshipName } from '@/lib/utils/relationship-name'

/** Minimal beer interface for menu schema generation */
interface MenuBeer {
  name: string
  description?: string | null
  abv: number
  style?: string | { name: string } | null
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
 * Convert a beer to a MenuItem
 */
function beerToMenuItem(beer: MenuBeer): MenuItemJsonLd {
  const styleName = relationshipName(beer.style) ?? 'Beer'

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

/** MenuItem with the four-pack price in place of the draft pour. */
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

function buildOnTapSection(beers: MenuBeer[]): MenuSectionJsonLd {
  return {
    '@type': 'MenuSection',
    name: 'On Tap',
    description: 'Draft beers currently pouring',
    hasMenuItem: beers.map(beerToMenuItem),
  }
}

function buildCansToGoSection(beers: MenuBeer[]): MenuSectionJsonLd {
  return {
    '@type': 'MenuSection',
    name: 'Cans To-Go',
    description: 'Beers available in cans',
    hasMenuItem: beers.map(beerToCanMenuItem),
  }
}

/**
 * Per-taproom Menu graph so "what's on tap at Lawrenceville" is distinct from Zelienople.
 */
export function generateLocationMenuSchema(args: {
  locationName: string
  locationSlug: string
  draftBeers: MenuBeer[]
  canBeers: MenuBeer[]
}): MenuJsonLd {
  const { locationName, locationSlug, draftBeers, canBeers } = args
  const pageUrl = `${LOLEV_BASE_URL}/${locationSlug}`
  const sections: MenuSectionJsonLd[] = []
  if (draftBeers.length > 0) sections.push(buildOnTapSection(draftBeers))
  if (canBeers.length > 0) sections.push(buildCansToGoSection(canBeers))

  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: ['Lolev Beer', locationName, 'Menu'].filter(Boolean).join(' '),
    description: `Draft and canned beers at Lolev Beer ${locationName}.`,
    url: pageUrl,
    inLanguage: 'en-US',
    mainEntityOfPage: pageUrl,
    hasMenuSection: sections,
  }
}
