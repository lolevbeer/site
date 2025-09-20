/**
 * Data fetching functions for client-side API calls
 * Provides typed wrappers around the API endpoints with error handling
 */

import {
  APIResponse,
  BeerList,
  BeerFilters,
  BeerSortOptions,
  EventList,
  EventFilters,
  EventSortOptions,
  EventCalendar,
  FoodVendorList,
  FoodVendorFilters,
  FoodVendorSortOptions,
  WeeklyFoodSchedule,
  Location,
  BeerStyle,
  EventType,
  EventStatus,
  CuisineType,
  DayOfWeek,
  FoodVendorType,
} from '../types';

/**
 * Base fetch configuration
 */
const FETCH_CONFIG = {
  headers: {
    'Content-Type': 'application/json',
  },
  // Add credentials if needed for authenticated requests
  // credentials: 'include' as RequestCredentials,
};

/**
 * Custom error class for API errors
 */
export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: APIResponse
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Generic API request handler with error handling
 */
async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<APIResponse<T>> {
  try {
    const response = await fetch(url, {
      ...FETCH_CONFIG,
      ...options,
    });

    if (!response.ok) {
      throw new APIError(
        `HTTP error! status: ${response.status}`,
        response.status
      );
    }

    const data: APIResponse<T> = await response.json();

    if (!data.success) {
      throw new APIError(
        data.error || 'API request failed',
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    // Network errors, JSON parsing errors, etc.
    throw new APIError(
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
}

/**
 * Build query string from object
 */
function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(item => searchParams.append(key, item.toString()));
      } else {
        searchParams.append(key, value.toString());
      }
    }
  });

  return searchParams.toString();
}

/**
 * Beer API fetchers
 */
export const beerAPI = {
  /**
   * Get filtered beer list
   */
  async getBeers(
    filters: Partial<BeerFilters> = {},
    sortOptions: Partial<BeerSortOptions> = {},
    limit?: number
  ): Promise<BeerList> {
    const params = {
      ...filters,
      ...sortOptions,
      limit,
    };

    const queryString = buildQueryString(params);
    const url = `/api/data/beer${queryString ? `?${queryString}` : ''}`;

    const response = await apiRequest<BeerList>(url);
    return response.data;
  },

  /**
   * Get beers by location
   */
  async getBeersByLocation(location: Location): Promise<BeerList> {
    return this.getBeers({ location });
  },

  /**
   * Get beers by style
   */
  async getBeersByStyle(style: BeerStyle): Promise<BeerList> {
    return this.getBeers({ style: [style] });
  },

  /**
   * Get draft beers only
   */
  async getDraftBeers(location?: Location): Promise<BeerList> {
    return this.getBeers({
      location,
      availability: 'draft',
    });
  },

  /**
   * Get canned beers only
   */
  async getCannedBeers(location?: Location): Promise<BeerList> {
    return this.getBeers({
      location,
      availability: 'cans',
    });
  },

  /**
   * Search beers
   */
  async searchBeers(query: string, location?: Location): Promise<BeerList> {
    return this.getBeers({
      search: query,
      location,
    });
  },
};

/**
 * Events API fetchers
 */
export const eventsAPI = {
  /**
   * Get filtered event list
   */
  async getEvents(
    filters: Partial<EventFilters> = {},
    sortOptions: Partial<EventSortOptions> = {},
    limit?: number
  ): Promise<EventList> {
    const params = {
      ...filters,
      ...sortOptions,
      limit,
    };

    const queryString = buildQueryString(params);
    const url = `/api/data/events${queryString ? `?${queryString}` : ''}`;

    const response = await apiRequest<EventList>(url);
    return response.data;
  },

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(location?: Location): Promise<EventList> {
    const params = {
      upcoming: true,
      location,
    };

    const queryString = buildQueryString(params);
    const url = `/api/data/events?${queryString}`;

    const response = await apiRequest<EventList>(url);
    return response.data;
  },

  /**
   * Get events by location
   */
  async getEventsByLocation(location: Location): Promise<EventList> {
    return this.getEvents({ location });
  },

  /**
   * Get events by type
   */
  async getEventsByType(type: EventType, location?: Location): Promise<EventList> {
    return this.getEvents({
      type: [type],
      location,
    });
  },

  /**
   * Get featured events
   */
  async getFeaturedEvents(location?: Location): Promise<EventList> {
    return this.getEvents({
      featuredOnly: true,
      location,
    });
  },

  /**
   * Search events
   */
  async searchEvents(query: string, location?: Location): Promise<EventList> {
    return this.getEvents({
      search: query,
      location,
    });
  },

  /**
   * Get event calendar for a specific month
   */
  async getEventCalendar(
    year: number,
    month: number,
    location?: Location
  ): Promise<EventCalendar> {
    const response = await apiRequest<EventCalendar>('/api/data/events', {
      method: 'POST',
      body: JSON.stringify({
        year,
        month,
        location,
      }),
    });

    return response.data;
  },

  /**
   * Get events for date range
   */
  async getEventsInRange(
    startDate: string,
    endDate: string,
    location?: Location
  ): Promise<EventList> {
    return this.getEvents({
      dateRange: { start: startDate, end: endDate },
      location,
    });
  },
};

/**
 * Food vendor API fetchers
 */
export const foodAPI = {
  /**
   * Get filtered food vendor schedule
   */
  async getFoodSchedule(
    filters: Partial<FoodVendorFilters> = {},
    sortOptions: Partial<FoodVendorSortOptions> = {},
    limit?: number
  ): Promise<FoodVendorList> {
    const params = {
      ...filters,
      ...sortOptions,
      limit,
    };

    const queryString = buildQueryString(params);
    const url = `/api/data/food${queryString ? `?${queryString}` : ''}`;

    const response = await apiRequest<FoodVendorList>(url);
    return response.data;
  },

  /**
   * Get current week's food schedule
   */
  async getCurrentWeekSchedule(location?: Location): Promise<FoodVendorList> {
    const params = {
      currentWeek: true,
      location,
    };

    const queryString = buildQueryString(params);
    const url = `/api/data/food?${queryString}`;

    const response = await apiRequest<FoodVendorList>(url);
    return response.data;
  },

  /**
   * Get food schedule by location
   */
  async getFoodScheduleByLocation(location: Location): Promise<FoodVendorList> {
    return this.getFoodSchedule({ location });
  },

  /**
   * Get food schedule by cuisine
   */
  async getFoodScheduleByCuisine(
    cuisine: CuisineType,
    location?: Location
  ): Promise<FoodVendorList> {
    return this.getFoodSchedule({
      cuisineTypes: [cuisine],
      location,
    });
  },

  /**
   * Get food schedule for a specific day
   */
  async getFoodScheduleForDay(
    day: DayOfWeek,
    location?: Location
  ): Promise<FoodVendorList> {
    return this.getFoodSchedule({
      daysOfWeek: [day],
      location,
    });
  },

  /**
   * Search food vendors
   */
  async searchFoodVendors(query: string, location?: Location): Promise<FoodVendorList> {
    return this.getFoodSchedule({
      search: query,
      location,
    });
  },

  /**
   * Get weekly food schedule
   */
  async getWeeklySchedule(
    weekStart?: string,
    location?: Location
  ): Promise<WeeklyFoodSchedule> {
    const response = await apiRequest<WeeklyFoodSchedule>('/api/data/food', {
      method: 'POST',
      body: JSON.stringify({
        weekStart,
        location,
      }),
    });

    return response.data;
  },

  /**
   * Get food schedule for date range
   */
  async getFoodScheduleInRange(
    startDate: string,
    endDate: string,
    location?: Location
  ): Promise<FoodVendorList> {
    return this.getFoodSchedule({
      dateRange: { start: startDate, end: endDate },
      location,
    });
  },
};

/**
 * Combined API object for easy importing
 */
export const api = {
  beer: beerAPI,
  events: eventsAPI,
  food: foodAPI,
};

/**
 * React Query/SWR compatible key factories for caching
 */
export const queryKeys = {
  beer: {
    all: ['beers'] as const,
    lists: () => [...queryKeys.beer.all, 'list'] as const,
    list: (filters: Partial<BeerFilters>, sort: Partial<BeerSortOptions>) =>
      [...queryKeys.beer.lists(), filters, sort] as const,
    location: (location: Location) =>
      [...queryKeys.beer.all, 'location', location] as const,
    style: (style: BeerStyle) =>
      [...queryKeys.beer.all, 'style', style] as const,
    search: (query: string) =>
      [...queryKeys.beer.all, 'search', query] as const,
  },
  events: {
    all: ['events'] as const,
    lists: () => [...queryKeys.events.all, 'list'] as const,
    list: (filters: Partial<EventFilters>, sort: Partial<EventSortOptions>) =>
      [...queryKeys.events.lists(), filters, sort] as const,
    upcoming: (location?: Location) =>
      [...queryKeys.events.all, 'upcoming', location] as const,
    calendar: (year: number, month: number, location?: Location) =>
      [...queryKeys.events.all, 'calendar', year, month, location] as const,
    location: (location: Location) =>
      [...queryKeys.events.all, 'location', location] as const,
    search: (query: string) =>
      [...queryKeys.events.all, 'search', query] as const,
  },
  food: {
    all: ['food'] as const,
    schedules: () => [...queryKeys.food.all, 'schedule'] as const,
    schedule: (filters: Partial<FoodVendorFilters>, sort: Partial<FoodVendorSortOptions>) =>
      [...queryKeys.food.schedules(), filters, sort] as const,
    currentWeek: (location?: Location) =>
      [...queryKeys.food.all, 'currentWeek', location] as const,
    weekly: (weekStart?: string, location?: Location) =>
      [...queryKeys.food.all, 'weekly', weekStart, location] as const,
    location: (location: Location) =>
      [...queryKeys.food.all, 'location', location] as const,
    search: (query: string) =>
      [...queryKeys.food.all, 'search', query] as const,
  },
};

export default api;