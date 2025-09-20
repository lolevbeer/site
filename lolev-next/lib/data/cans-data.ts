/**
 * Canned beers data
 * Auto-generated from _data/lawrenceville-cans.csv and zelienople-cans.csv
 */

import { BeerVariant, Location } from '@/lib/types/beer';

export interface CannedBeer {
  variant: BeerVariant;
  name: string;
  type: string;
  abv: number;
  cansAvailable: boolean;
  singlePrice: number;
  fourPackPrice: number;
  location: Location;
  onSale?: boolean;
}

// Lawrenceville canned beers (from CSV)
export const lawrencevilleCannedBeers: CannedBeer[] = [
  {
    variant: 'rooted' as BeerVariant,
    name: 'Rooted',
    type: 'Mexican Lager',
    abv: 4,
    cansAvailable: true,
    singlePrice: 4.00,
    fourPackPrice: 15,
    location: Location.LAWRENCEVILLE,
    onSale: false
  },
  {
    variant: 'samo' as BeerVariant,
    name: 'Samo',
    type: 'Pilsner',
    abv: 4.8,
    cansAvailable: true,
    singlePrice: 4.00,
    fourPackPrice: 15,
    location: Location.LAWRENCEVILLE,
    onSale: false
  },
  {
    variant: 'sonnen' as BeerVariant,
    name: 'Sonnen',
    type: 'Märzen',
    abv: 5.4,
    cansAvailable: true,
    singlePrice: 4.50,
    fourPackPrice: 17,
    location: Location.LAWRENCEVILLE,
    onSale: false
  },
  {
    variant: 'akko' as BeerVariant,
    name: 'Akko',
    type: 'India Pale Ale',
    abv: 7,
    cansAvailable: false,
    singlePrice: 4.50,
    fourPackPrice: 17,
    location: Location.LAWRENCEVILLE,
    onSale: false
  },
  {
    variant: 'priscus-ii' as BeerVariant,
    name: 'Priscus II',
    type: 'Double IPA',
    abv: 8.3,
    cansAvailable: true,
    singlePrice: 5.75,
    fourPackPrice: 22,
    location: Location.LAWRENCEVILLE,
    onSale: false
  },
  {
    variant: 'double-prismatic' as BeerVariant,
    name: 'Double Prismatic',
    type: 'Double IPA',
    abv: 8.3,
    cansAvailable: true,
    singlePrice: 5.25,
    fourPackPrice: 20,
    location: Location.LAWRENCEVILLE,
    onSale: false
  },
  {
    variant: 'ddh-lupula' as BeerVariant,
    name: 'DDH Lupula',
    type: 'India Pale Ale',
    abv: 7,
    cansAvailable: true,
    singlePrice: 5.25,
    fourPackPrice: 20,
    location: Location.LAWRENCEVILLE,
    onSale: false
  },
  {
    variant: 'ddh-akko' as BeerVariant,
    name: 'DDH Akko',
    type: 'India Pale Ale',
    abv: 7,
    cansAvailable: true,
    singlePrice: 5.25,
    fourPackPrice: 20,
    location: Location.LAWRENCEVILLE,
    onSale: false
  },
  {
    variant: 'ddh-taupo' as BeerVariant,
    name: 'DDH Taupō',
    type: 'India Pale Ale',
    abv: 7,
    cansAvailable: true,
    singlePrice: 5.25,
    fourPackPrice: 20,
    location: Location.LAWRENCEVILLE,
    onSale: false
  },
  {
    variant: 'double-lupula' as BeerVariant,
    name: 'Double Lupula',
    type: 'Double IPA',
    abv: 8.4,
    cansAvailable: true,
    singlePrice: 5.25,
    fourPackPrice: 20,
    location: Location.LAWRENCEVILLE,
    onSale: false
  },
  {
    variant: 'rubico' as BeerVariant,
    name: 'Rubico',
    type: 'Double IPA',
    abv: 8.5,
    cansAvailable: true,
    singlePrice: 5.25,
    fourPackPrice: 20,
    location: Location.LAWRENCEVILLE,
    onSale: false
  }
];

// Zelienople canned beers would go here (when available)
export const zelienopleCannedBeers: CannedBeer[] = [];

// Combine all canned beers
export const cannedBeers: CannedBeer[] = [
  ...lawrencevilleCannedBeers,
  ...zelienopleCannedBeers
];

// Get canned beers by location
export function getCannedBeersByLocation(location: Location): CannedBeer[] {
  return cannedBeers.filter(beer => beer.location === location);
}

// Get available canned beers
export function getAvailableCans(location?: Location): CannedBeer[] {
  let beers = cannedBeers.filter(beer => beer.cansAvailable);
  if (location) {
    beers = beers.filter(beer => beer.location === location);
  }
  return beers;
}

export default cannedBeers;