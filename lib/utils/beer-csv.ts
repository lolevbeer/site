/**
 * Beer data utilities - now using Payload CMS
 * This file maintains backward compatibility with the old CSV-based API
 */

import { Beer } from '@/lib/types/beer';
import { getAllBeersFromPayload, getBeerBySlug, getMenusByLocation } from './payload-api';
import { convertPayloadBeer, getBeersWithAvailability } from './payload-adapter';
import { cache } from 'react';

/**
 * Get all beers from Payload CMS (replaces CSV)
 */
export const getAllBeersFromCSV = cache(async (): Promise<Beer[]> => {
  // Get all beers from Payload
  const payloadBeers = await getAllBeersFromPayload();

  // Get menus for both locations
  const [lawrencevilleMenus, zelienopleMenus] = await Promise.all([
    getMenusByLocation('lawrenceville'),
    getMenusByLocation('zelienople'),
  ]);

  // Combine all menus
  const allMenus = [...lawrencevilleMenus, ...zelienopleMenus];

  // Convert and enrich beers with menu data
  const beers = await getBeersWithAvailability(payloadBeers, allMenus);

  return beers;
});

/**
 * Get beer by variant/slug from Payload CMS (replaces CSV)
 */
export async function getBeerByVariant(variant: string): Promise<Beer | null> {
  const beer = await getBeerBySlug(variant);
  if (!beer) return null;

  // Get menu data to enrich availability
  const [lawrencevilleMenus, zelienopleMenus] = await Promise.all([
    getMenusByLocation('lawrenceville'),
    getMenusByLocation('zelienople'),
  ]);

  const allMenus = [...lawrencevilleMenus, ...zelienopleMenus];
  const beersWithAvailability = await getBeersWithAvailability([beer], allMenus);

  return beersWithAvailability[0] || null;
}
