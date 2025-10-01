/**
 * Sample data exports for API routes
 * This file provides sample/mock data for events and food vendors
 */

import { BreweryEvent, EventStatus, EventType } from '@/lib/types/event';
import { FoodVendor } from '@/lib/types/food';
import { Location } from '@/lib/types/location';

// Sample events data
export const sampleEvents: BreweryEvent[] = [];

// Get upcoming events
export function getUpcomingEvents(events: BreweryEvent[] = sampleEvents): BreweryEvent[] {
  const now = new Date();
  return events.filter(event => new Date(event.date) >= now);
}

// Get sample data by location
export function getSampleDataByLocation(location: Location, data: any[]): any[] {
  return data.filter(item => item.location === location);
}

// Sample food vendors
export const sampleFoodVendors: FoodVendor[] = [];

// Export function for food vendors by location
export function getFoodVendorsByLocation(location: Location): FoodVendor[] {
  return sampleFoodVendors.filter(vendor => vendor.locations?.includes(location));
}