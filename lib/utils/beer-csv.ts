/**
 * Beer data utilities - now using Payload CMS
 * This file maintains backward compatibility with the old CSV-based API
 */

import { Beer } from '@/lib/types/beer';
import { getAllBeersFromPayload, getBeerBySlug, getMenusByLocation, getAllLocations } from './payload-api';
import { getBeersWithAvailability } from './payload-adapter';
import { cache } from 'react';

/**
 * Get all beers from Payload CMS (replaces CSV)
 */
export const getAllBeersFromCSV = cache(async (): Promise<Beer[]> => {
  // Get all beers from Payload
  const payloadBeers = await getAllBeersFromPayload();

  // Get all locations from database
  const locations = await getAllLocations();
  const locationSlugs = locations.map(loc => loc.slug || loc.id);

  // Get menus for all locations dynamically
  const menuPromises = locationSlugs.map(slug => getMenusByLocation(slug));
  const menusByLocation = await Promise.all(menuPromises);

  // Combine all menus
  const allMenus = menusByLocation.flat();

  // Convert and enrich beers with menu data
  const beers = getBeersWithAvailability(payloadBeers, allMenus);

  return beers;
});

/**
 * Get beer by variant/slug from Payload CMS (replaces CSV)
 */
export async function getBeerByVariant(variant: string): Promise<Beer | null> {
  const beer = await getBeerBySlug(variant);
  if (!beer) return null;

  // Get all locations from database
  const locations = await getAllLocations();
  const locationSlugs = locations.map(loc => loc.slug || loc.id);

  // Get menus for all locations dynamically
  const menuPromises = locationSlugs.map(slug => getMenusByLocation(slug));
  const menusByLocation = await Promise.all(menuPromises);

  const allMenus = menusByLocation.flat();
  const beersWithAvailability = getBeersWithAvailability([beer], allMenus);

  return beersWithAvailability[0] || null;
}
