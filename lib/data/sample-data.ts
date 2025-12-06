/**
 * Sample data exports for API routes
 * This file provides sample/mock data for events and food vendors
 */

import { BreweryEvent } from '@/lib/types/event';
import { FoodVendor } from '@/lib/types/food';
import type { LocationSlug } from '@/lib/types/location';

// Sample events data
export const sampleEvents: BreweryEvent[] = [];

// Get upcoming events
export function getUpcomingEvents(events: BreweryEvent[] = sampleEvents): BreweryEvent[] {
  const now = new Date();
  return events.filter(event => new Date(event.date) >= now);
}

// Get sample data by location
export function getSampleDataByLocation(location: LocationSlug, data: any[]): any[] {
  return data.filter(item => item.location === location);
}

// Sample food vendors
export const sampleFoodVendors: FoodVendor[] = [];

// Export function for food vendors by location
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getFoodVendorsByLocation(_location: LocationSlug): FoodVendor[] {
  // TODO: Filter by location when FoodVendor type includes location-specific data
  // For now, return all vendors as they may serve at both locations
  return sampleFoodVendors;
}