/**
 * Coming Soon beers data
 * Auto-generated from _data/coming.csv
 */

import { BeerVariant } from '@/lib/types/beer';

export interface ComingSoonBeer {
  id: string;
  name: string;
  variant?: BeerVariant;
  type: string;
  tempName?: string;
  estimatedRelease?: string;
  description?: string;
}

export const comingSoonBeers: ComingSoonBeer[] = [
  {
    id: 'cs-vespero',
    name: 'Vespero',
    variant: 'vespero' as BeerVariant,
    type: 'Czech Dark Lager',
    description: 'A rich, dark Czech lager with complex malt character'
  },
  {
    id: 'cs-west-coast-pils',
    name: 'West Coast Pils',
    tempName: 'West Coast Pils',
    type: 'Pilsner',
    description: 'A hop-forward pilsner with West Coast IPA influences'
  },
  {
    id: 'cs-pumpkin-stout',
    name: 'Pumpkin Stout',
    tempName: 'Pumpkin Stout',
    type: 'Stout',
    description: 'Seasonal stout with real pumpkin and warming spices'
  },
  {
    id: 'cs-priscus',
    name: 'Priscus',
    variant: 'priscus' as BeerVariant,
    type: 'Double IPA',
    description: 'Bold and hop-forward double IPA'
  },
  {
    id: 'cs-faust',
    name: 'Faust',
    variant: 'faust' as BeerVariant,
    type: 'Imperial Saison',
    description: 'Complex imperial saison aged in oak'
  },
  {
    id: 'cs-imperial-stout',
    name: 'Imperial Stout',
    tempName: 'Imperial Stout',
    type: 'Imperial Stout',
    description: 'Rich, roasted imperial stout with notes of chocolate and coffee'
  },
  {
    id: 'cs-grandar',
    name: 'Grandar',
    variant: 'grandar' as BeerVariant,
    type: 'West Coast IPA',
    description: 'Classic West Coast IPA with piney and citrus hop character'
  },
  {
    id: 'cs-west-coast-ipa',
    name: 'West Coast IPA',
    tempName: 'West Coast IPA',
    type: 'West Coast IPA',
    description: 'Crisp, bitter, and aromatic West Coast style IPA'
  }
];

export default comingSoonBeers;