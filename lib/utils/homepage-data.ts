/**
 * Consolidated homepage data fetching.
 * Single source of truth for all homepage data requirements.
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

/** Next event summary for quick info display */
export interface NextEventInfo {
  name: string;
  date: string;
  location: string;
}

/** Event item with location info */
interface EventItem {
  organizer: string;
  date: string;
  location: string | { slug?: string; name?: string };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface HomePageData {
  // Core data
  locations: PayloadLocation[];
  availableBeers: PayloadBeer[];
  comingSoonBeers: any[];
  authenticated: boolean;
  siteContent: Awaited<ReturnType<typeof getSiteContent>>;

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
  nextEvent: NextEventInfo | null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Fetch weekly hours for all locations.
 * Shared helper used by both homepage data and layout.
 */
export async function getWeeklyHoursForLocations(
  locations: PayloadLocation[]
): Promise<Record<string, WeeklyHoursDay[]>> {
  const entries = await Promise.all(
    locations.map(async (location) => {
      const hours = await getWeeklyHoursWithHolidays(location.id);
      return [location.slug || location.id, hours] as const;
    })
  );
  return Object.fromEntries(entries);
}

/** Extract next event info from array of events */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deriveNextEvent(events: any[]): NextEventInfo | null {
  if (events.length === 0) return null;

  const event = events[0] as EventItem;
  const location = event.location;
  const locationSlug = typeof location === 'string'
    ? location
    : location?.slug || location?.name || '';

  return {
    name: event.organizer,
    date: event.date,
    location: locationSlug,
  };
}

/**
 * Fetch all data required for the homepage in a single optimized operation.
 * Uses React cache for automatic deduplication within a request.
 */
export const getHomePageData = cache(async (): Promise<HomePageData> => {
  // Fetch location-independent data in parallel
  const [locations, availableBeers, comingSoonBeers, siteContent] = await Promise.all([
    getAllLocations(),
    getAvailableBeersFromMenus(),
    getComingSoonBeers(),
    getSiteContent(),
  ]);

  // Auth is handled client-side to avoid cookies() breaking static generation
  const authenticated = false;
  const locationSlugs = locations.map((loc) => loc.slug || loc.id);

  // Fetch location-specific data in parallel
  const [
    draftMenuResults,
    cansMenuResults,
    eventsResults,
    foodResults,
    eventsMarketingResults,
    foodMarketingResults,
  ] = await Promise.all([
    Promise.all(locationSlugs.map((slug) => getDraftMenu(slug))),
    Promise.all(locationSlugs.map((slug) => getCansMenu(slug))),
    Promise.all(locationSlugs.map((slug) => getUpcomingEventsFromPayload(slug, 3))),
    Promise.all(locationSlugs.map((slug) => getCombinedUpcomingFood(slug, 3))),
    Promise.all(locationSlugs.map((slug) => getUpcomingEventsFromPayload(slug, 10))),
    Promise.all(locationSlugs.map((slug) => getCombinedUpcomingFood(slug, 10))),
  ]);

  // Transform arrays into location-keyed objects
  const draftMenusByLocation = arrayToLocationMap(locationSlugs, draftMenuResults);
  const cansMenusByLocation = arrayToLocationMap(locationSlugs, cansMenuResults);
  const eventsByLocation = arrayToLocationMap(locationSlugs, eventsResults);
  const foodByLocation = arrayToLocationMap(locationSlugs, foodResults);
  const eventsMarketingByLocation = arrayToLocationMap(locationSlugs, eventsMarketingResults);
  const foodMarketingByLocation = arrayToLocationMap(locationSlugs, foodMarketingResults);

  // Fetch weekly hours for each location
  const weeklyHours = await getWeeklyHoursForLocations(locations);

  // Derive additional data needed by components
  const allDraftMenus = Object.values(draftMenusByLocation).filter((m): m is PayloadMenu => m !== null);
  const allCansMenus = Object.values(cansMenusByLocation).filter((m): m is PayloadMenu => m !== null);
  const beerCount: Record<string, number> = Object.fromEntries(
    locationSlugs.map((slug) => [slug, draftMenusByLocation[slug]?.items?.length || 0])
  );
  const allEvents = Object.values(eventsByLocation).flat();
  const allFood = Object.values(foodByLocation).flat();
  const nextEvent = deriveNextEvent(allEvents);

  return {
    locations,
    availableBeers,
    comingSoonBeers,
    authenticated,
    siteContent,
    draftMenusByLocation,
    cansMenusByLocation,
    eventsByLocation,
    foodByLocation,
    eventsMarketingByLocation,
    foodMarketingByLocation,
    weeklyHours,
    allDraftMenus,
    allCansMenus,
    beerCount,
    allEvents,
    allFood,
    nextEvent,
  };
});
