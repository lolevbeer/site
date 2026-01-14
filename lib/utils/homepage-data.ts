/**
 * Consolidated homepage data fetching
 * Single source of truth for all homepage data requirements
 */

import { cache } from 'react';
import {
  getDraftMenu,
  getCansMenu,
  getAvailableBeersFromMenus,
  getComingSoonBeers,
  getAllLocations,
  getWeeklyHoursWithHolidays,
  getUpcomingEventsFromPayload,
  getCombinedUpcomingFood,
  type WeeklyHoursDay,
  type RecurringFoodEntry,
} from './payload-api';
import { getSiteContent } from './site-content';
import { arrayToLocationMap } from './array-helpers';
import type { Menu as PayloadMenu, Beer as PayloadBeer, Location as PayloadLocation } from '@/src/payload-types';

export interface HomePageData {
  // Core data
  locations: PayloadLocation[];
  availableBeers: PayloadBeer[];
  comingSoonBeers: any[]; // From Payload global
  authenticated: boolean;
  siteContent: any;

  // Location-specific data
  draftMenusByLocation: Record<string, PayloadMenu | null>;
  cansMenusByLocation: Record<string, PayloadMenu | null>;
  eventsByLocation: Record<string, any[]>;
  foodByLocation: Record<string, any[]>;
  eventsMarketingByLocation: Record<string, any[]>;
  foodMarketingByLocation: Record<string, any[]>;
  weeklyHours: Record<string, WeeklyHoursDay[]>;

  // Derived data for components
  allDraftMenus: PayloadMenu[];
  allCansMenus: PayloadMenu[];
  beerCount: Record<string, number>;
  allEvents: any[];
  allFood: any[];
  nextEvent: { name: string; date: string; location: string } | null;
}

/**
 * Fetch all data required for the homepage in a single optimized operation
 * Uses React cache for automatic deduplication within a request
 */
export const getHomePageData = cache(async (): Promise<HomePageData> => {
  // Step 1: Fetch location-independent data in parallel
  // Note: Authentication is checked client-side to keep the page static/cached
  const [locations, availableBeers, comingSoonBeers, siteContent] =
    await Promise.all([
      getAllLocations(),
      getAvailableBeersFromMenus(),
      getComingSoonBeers(),
      getSiteContent(),
    ]);

  // Auth is now handled client-side to avoid cookies() breaking static generation
  const authenticated = false;

  // Step 2: Extract location slugs for dynamic fetching
  const locationSlugs = locations.map((loc) => loc.slug || loc.id);

  // Step 3: Fetch location-specific data in parallel
  const [
    draftMenuResults,
    cansMenuResults,
    eventsResults,
    foodResults,
    eventsMarketingResults,
    foodMarketingResults,
  ] = await Promise.all([
    // Menus
    Promise.all(locationSlugs.map((slug) => getDraftMenu(slug))),
    Promise.all(locationSlugs.map((slug) => getCansMenu(slug))),
    // Events and food (3 items for main display)
    // Food now includes both individual and recurring entries
    Promise.all(locationSlugs.map((slug) => getUpcomingEventsFromPayload(slug, 3))),
    Promise.all(locationSlugs.map((slug) => getCombinedUpcomingFood(slug, 3))),
    // Events and food (10 items for marketing overlay)
    Promise.all(locationSlugs.map((slug) => getUpcomingEventsFromPayload(slug, 10))),
    Promise.all(locationSlugs.map((slug) => getCombinedUpcomingFood(slug, 10))),
  ]);

  // Step 4: Transform arrays into location-keyed objects (DRY with helper)
  const draftMenusByLocation = arrayToLocationMap(locationSlugs, draftMenuResults);
  const cansMenusByLocation = arrayToLocationMap(locationSlugs, cansMenuResults);
  const eventsByLocation = arrayToLocationMap(locationSlugs, eventsResults);
  const foodByLocation = arrayToLocationMap(locationSlugs, foodResults);
  const eventsMarketingByLocation = arrayToLocationMap(locationSlugs, eventsMarketingResults);
  const foodMarketingByLocation = arrayToLocationMap(locationSlugs, foodMarketingResults);

  // Step 5: Fetch weekly hours for each location
  const weeklyHoursEntries = await Promise.all(
    locations.map(async (location) => {
      const hours = await getWeeklyHoursWithHolidays(location.id);
      return [location.slug || location.id, hours] as const;
    })
  );
  const weeklyHours: Record<string, WeeklyHoursDay[]> = Object.fromEntries(weeklyHoursEntries);

  // Step 6: Derive additional data needed by components
  const allDraftMenus = Object.values(draftMenusByLocation).filter(
    (m): m is PayloadMenu => m !== null
  );
  const allCansMenus = Object.values(cansMenusByLocation).filter(
    (m): m is PayloadMenu => m !== null
  );

  const beerCount: Record<string, number> = Object.fromEntries(
    locationSlugs.map((slug) => [slug, draftMenusByLocation[slug]?.items?.length || 0])
  );

  const allEvents = Object.values(eventsByLocation).flat();
  const allFood = Object.values(foodByLocation).flat();

  const nextEvent =
    allEvents.length > 0
      ? {
          name: allEvents[0].organizer,
          date: allEvents[0].date,
          // Extract location slug/name from either string ID or hydrated object
          location: typeof allEvents[0].location === 'string'
            ? allEvents[0].location
            : (allEvents[0].location?.slug || allEvents[0].location?.name || ''),
        }
      : null;

  // Step 7: Return consolidated data structure
  return {
    // Core data
    locations,
    availableBeers,
    comingSoonBeers,
    authenticated,
    siteContent,

    // Location-specific data
    draftMenusByLocation,
    cansMenusByLocation,
    eventsByLocation,
    foodByLocation,
    eventsMarketingByLocation,
    foodMarketingByLocation,
    weeklyHours,

    // Derived data
    allDraftMenus,
    allCansMenus,
    beerCount,
    allEvents,
    allFood,
    nextEvent,
  };
});
