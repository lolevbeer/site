/**
 * Data Service Layer
 * Centralized data fetching and caching service
 * Separates data concerns from UI components
 */

import { Beer } from '@/lib/types/beer';
import { BreweryEvent } from '@/lib/types/event';
import { FoodVendor } from '@/lib/types/food';
import { Location } from '@/lib/types/location';

/**
 * Cache configuration
 */
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>();

/**
 * Generic cache helper
 */
function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > CACHE_DURATION) {
    cache.delete(key);
    return null;
  }

  return cached.data as T;
}

function setCached<T>(key: string, data: T): T {
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

/**
 * Base API endpoints
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/data';

/**
 * Generic fetch helper with error handling
 */
async function fetchData<T>(endpoint: string): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Beer Data Service
 */
export class BeerService {
  static async getAll(): Promise<Beer[]> {
    const cacheKey = 'beer:all';
    const cached = getCached<Beer[]>(cacheKey);
    if (cached) return cached;

    const data = await fetchData<Beer[]>('/beer');
    return setCached(cacheKey, data);
  }

  static async getByLocation(location: Location): Promise<Beer[]> {
    const cacheKey = `beer:${location}`;
    const cached = getCached<Beer[]>(cacheKey);
    if (cached) return cached;

    const allBeers = await this.getAll();
    // TODO: Filter by location when Beer type includes location-specific data
    // For now, return all beers as they may be available at both locations
    return setCached(cacheKey, allBeers);
  }

  static async getByVariant(variant: string): Promise<Beer | null> {
    const cacheKey = `beer:variant:${variant}`;
    const cached = getCached<Beer>(cacheKey);
    if (cached) return cached;

    const allBeers = await this.getAll();
    const beer = allBeers.find(b =>
      b.variant.toLowerCase() === variant.toLowerCase()
    );
    return beer ? setCached(cacheKey, beer) : null;
  }

  static async getAvailable(): Promise<Beer[]> {
    const allBeers = await this.getAll();
    return allBeers.filter(beer =>
      !beer.availability.hideFromSite &&
      (beer.availability.tap || beer.availability.cansAvailable)
    );
  }

  static clearCache(): void {
    for (const key of cache.keys()) {
      if (key.startsWith('beer:')) {
        cache.delete(key);
      }
    }
  }
}

/**
 * Event Data Service
 */
export class EventService {
  static async getAll(): Promise<BreweryEvent[]> {
    const cacheKey = 'events:all';
    const cached = getCached<BreweryEvent[]>(cacheKey);
    if (cached) return cached;

    const data = await fetchData<BreweryEvent[]>('/events');
    return setCached(cacheKey, data);
  }

  static async getByLocation(location: Location): Promise<BreweryEvent[]> {
    const cacheKey = `events:${location}`;
    const cached = getCached<BreweryEvent[]>(cacheKey);
    if (cached) return cached;

    const allEvents = await this.getAll();
    const filtered = allEvents.filter(event => event.location === location);
    return setCached(cacheKey, filtered);
  }

  static async getUpcoming(daysAhead = 30): Promise<BreweryEvent[]> {
    const allEvents = await this.getAll();
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return allEvents.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate >= now && eventDate <= futureDate;
    }).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  static async getToday(): Promise<BreweryEvent[]> {
    const allEvents = await this.getAll();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return allEvents.filter(event => {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate.getTime() === today.getTime();
    });
  }

  static clearCache(): void {
    for (const key of cache.keys()) {
      if (key.startsWith('events:')) {
        cache.delete(key);
      }
    }
  }
}

/**
 * Food Vendor Service
 */
export class FoodVendorService {
  static async getAll(): Promise<FoodVendor[]> {
    const cacheKey = 'vendors:all';
    const cached = getCached<FoodVendor[]>(cacheKey);
    if (cached) return cached;

    const data = await fetchData<FoodVendor[]>('/food');
    return setCached(cacheKey, data);
  }

  static async getActive(): Promise<FoodVendor[]> {
    const allVendors = await this.getAll();
    return allVendors.filter(vendor => vendor.isActive);
  }

  static async getByLocation(location: Location): Promise<FoodVendor[]> {
    const cacheKey = `vendors:${location}`;
    const cached = getCached<FoodVendor[]>(cacheKey);
    if (cached) return cached;

    const allVendors = await this.getAll();
    // TODO: Filter by location when FoodVendor type includes location-specific data
    // For now, return all vendors as they may serve at both locations
    return setCached(cacheKey, allVendors);
  }

  static async getById(id: string): Promise<FoodVendor | null> {
    const cacheKey = `vendors:id:${id}`;
    const cached = getCached<FoodVendor>(cacheKey);
    if (cached) return cached;

    const allVendors = await this.getAll();
    const vendor = allVendors.find(v => v.id === id);
    return vendor ? setCached(cacheKey, vendor) : null;
  }

  static clearCache(): void {
    for (const key of cache.keys()) {
      if (key.startsWith('vendors:')) {
        cache.delete(key);
      }
    }
  }
}

/**
 * Combined Data Service
 * Provides methods that combine data from multiple sources
 */
export class DataService {
  static async getLocationData(location: Location) {
    const [beers, events, vendors] = await Promise.all([
      BeerService.getByLocation(location),
      EventService.getByLocation(location),
      FoodVendorService.getByLocation(location)
    ]);

    return {
      beers,
      events,
      vendors,
      location
    };
  }

  static async getTodayOverview() {
    const [events, beers] = await Promise.all([
      EventService.getToday(),
      BeerService.getAvailable()
    ]);

    return {
      todayEvents: events,
      availableBeers: beers.length,
      onTap: beers.filter(b => b.availability.tap).length,
      // TODO: Add isNew field to Beer type to track new arrivals
      newArrivals: 0
    };
  }

  static clearAllCaches(): void {
    cache.clear();
  }

  static async prefetchAll(): Promise<void> {
    await Promise.all([
      BeerService.getAll(),
      EventService.getAll(),
      FoodVendorService.getAll()
    ]);
  }
}