/**
 * Draft beers data
 * Auto-generated from _data/lawrenceville-draft.csv and zelienople-draft.csv
 */

import { Beer, BeerVariant, BeerType, BeerGlass, Location } from '@/lib/types/beer';

export interface DraftBeer {
  tap: number;
  variant: BeerVariant;
  name: string;
  type: string;
  abv: number;
  glass: BeerGlass;
  price: number;
  description: string;
  hops?: string;
  location: Location;
  hasImage?: boolean;
  singleCanAvailable?: boolean;
}

// Lawrenceville draft beers (from CSV)
export const lawrencevilleDraftBeers: DraftBeer[] = [
  {
    tap: 1,
    variant: 'vespero' as BeerVariant,
    name: 'Vespero',
    type: 'Czech Dark Lager',
    abv: 5.8,
    glass: BeerGlass.STEIN,
    price: 6,
    description: 'Roasted chestnut, chocolate and raisin. Ruby hue and a hint of noble hops.',
    hops: 'Saaz',
    location: Location.LAWRENCEVILLE,
    hasImage: true,
    singleCanAvailable: false
  },
  {
    tap: 2,
    variant: 'verus' as BeerVariant,
    name: 'Verus',
    type: 'India Pale Ale',
    abv: 7,
    glass: BeerGlass.PINT,
    price: 7,
    description: 'Tropical fruit notes balanced with pear, melon, blueberry and citrus.',
    hops: 'Erebus™, Calypso™, Citra®',
    location: Location.LAWRENCEVILLE,
    hasImage: true,
    singleCanAvailable: false
  },
  {
    tap: 3,
    variant: 'sonnen' as BeerVariant,
    name: 'Sonnen',
    type: 'Märzen',
    abv: 5.4,
    glass: BeerGlass.STEIN,
    price: 6,
    description: 'Plush tan head, a subtle sweetness of toasted malt, medium body.',
    location: Location.LAWRENCEVILLE,
    hasImage: true,
    singleCanAvailable: false
  },
  {
    tap: 4,
    variant: 'prismatic' as BeerVariant,
    name: 'Prismatic',
    type: 'India Pale Ale',
    abv: 7,
    glass: BeerGlass.PINT,
    price: 7,
    description: 'Pineapple, vanilla, tangerine, melon.',
    hops: 'El Dorado®, Idaho 7™, Citra®',
    location: Location.LAWRENCEVILLE,
    hasImage: true,
    singleCanAvailable: false
  },
  {
    tap: 5,
    variant: 'priscus-ii' as BeerVariant,
    name: 'Priscus II',
    type: 'Double IPA',
    abv: 8.3,
    glass: BeerGlass.PINT,
    price: 9,
    description: 'Hop saturated variant. Sauvignon blanc, blueberry and citrus.',
    hops: 'Motueka CGX, Nelson Sauvin™, Citra®',
    location: Location.LAWRENCEVILLE,
    hasImage: true,
    singleCanAvailable: false
  },
  {
    tap: 6,
    variant: 'ddh-lupula' as BeerVariant,
    name: 'DDH Lupula',
    type: 'India Pale Ale',
    abv: 7,
    glass: BeerGlass.PINT,
    price: 8,
    description: 'Double dry hopped Lupula. Notes of Pineapple, mango, and grapefruit. Aromatic.',
    hops: 'Motueka™, Moutere™, Riwaka™',
    location: Location.LAWRENCEVILLE,
    hasImage: true,
    singleCanAvailable: false
  },
  {
    tap: 7,
    variant: 'akko' as BeerVariant,
    name: 'Akko',
    type: 'India Pale Ale',
    abv: 7,
    glass: BeerGlass.PINT,
    price: 7,
    description: 'Pineapple and orange mango, notes of peach ring candies.',
    hops: 'Comet, Galaxy®, Citra®',
    location: Location.LAWRENCEVILLE,
    hasImage: true,
    singleCanAvailable: false
  },
  {
    tap: 8,
    variant: 'double-lupula' as BeerVariant,
    name: 'Double Lupula',
    type: 'Double IPA',
    abv: 8.4,
    glass: BeerGlass.PINT,
    price: 8,
    description: 'More hops, more malt, more everything. Everything Lupula is and more.',
    hops: 'Motueka™, Moutere™, Riwaka™',
    location: Location.LAWRENCEVILLE,
    hasImage: true,
    singleCanAvailable: false
  },
  {
    tap: 9,
    variant: 'rubico' as BeerVariant,
    name: 'Rubico',
    type: 'Double IPA',
    abv: 8.5,
    glass: BeerGlass.PINT,
    price: 8,
    description: 'Pineapple, peach rings, bubblegum, strawberry and citrus.',
    hops: 'Mosaic®, Galaxy®, Citra®',
    location: Location.LAWRENCEVILLE,
    hasImage: true,
    singleCanAvailable: false
  },
  {
    tap: 10,
    variant: 'faust-unfiltered-25' as BeerVariant,
    name: 'Faust',
    type: 'Imperial Plum Saison',
    abv: 9.3,
    glass: BeerGlass.TEKU,
    price: 10,
    description: 'Unfiltered 2025 vintage. Slightly sour, dry and oaky. Aged 18 months in oak foeders on our house microflora and conditioned on plums.',
    location: Location.LAWRENCEVILLE,
    hasImage: false,
    singleCanAvailable: false
  }
];

// Zelienople draft beers would go here (when available)
export const zelienopleDraftBeers: DraftBeer[] = [];

// Combine all draft beers
export const draftBeers: DraftBeer[] = [
  ...lawrencevilleDraftBeers,
  ...zelienopleDraftBeers
];

// Get draft beers by location
export function getDraftBeersByLocation(location: Location): DraftBeer[] {
  return draftBeers.filter(beer => beer.location === location);
}

// Get current tap list for a location
export function getTapList(location: Location): DraftBeer[] {
  return getDraftBeersByLocation(location).sort((a, b) => a.tap - b.tap);
}

export default draftBeers;