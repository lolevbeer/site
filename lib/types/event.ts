/**
 * Event type definitions for brewery events
 */

import type { LocationSlug } from './location';

/**
 * Event types/categories
 */
export enum EventType {
  TRIVIA = 'trivia',
  LIVE_MUSIC = 'live_music',
  GAME_NIGHT = 'game_night',
  SPECIAL_EVENT = 'special_event',
  SPECIAL = 'special',
  MARKET = 'market',
  SPORTS = 'sports',
  ENTERTAINMENT = 'entertainment',
  PRIVATE_EVENT = 'private_event',
  BREWERY_TOUR = 'brewery_tour',
  TASTING = 'tasting',
  FOOD_PAIRING = 'food_pairing',
  FOOD_TRUCK = 'food_truck',
  COMMUNITY = 'community',
  SEASONAL = 'seasonal',
  RECURRING = 'recurring',
}

/**
 * Event status
 */
export enum EventStatus {
  SCHEDULED = 'scheduled',
  CANCELLED = 'cancelled',
  POSTPONED = 'postponed',
  SOLD_OUT = 'sold_out',
  COMPLETED = 'completed',
  DRAFT = 'draft',
}

/**
 * Base event interface
 */
export interface BaseEvent {
  id?: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  endTime?: string;
  attendees?: number;
  site?: string;
  type: EventType;
  status: EventStatus;
  location: LocationSlug;
}

/**
 * Brewery event interface
 */
export interface BreweryEvent extends BaseEvent {
  vendor: string;
  end?: string | number;
  tags?: string[];
  image?: string;
  price?: string;
  ageRestriction?: string;
  requirements?: string[];
}

/**
 * Event search and filter interface
 */
export interface EventFilters {
  location?: LocationSlug;
  type?: EventType[];
  dateRange?: { start: string; end: string };
  status?: EventStatus[];
  search?: string;
  freeOnly?: boolean;
}

/**
 * Event sorting options
 */
export type EventSortBy = 'date' | 'title' | 'type' | 'attendees';
export type EventSortOrder = 'asc' | 'desc';

export interface EventSortOptions {
  sortBy: EventSortBy;
  order: EventSortOrder;
}
