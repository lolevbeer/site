/**
 * Event type definitions for brewery events
 * Based on CSV data schema from _data/*-events.csv files
 */

import { Location } from './location';

/**
 * Event types/categories
 */
export enum EventType {
  TRIVIA = 'trivia',
  LIVE_MUSIC = 'live_music',
  GAME_NIGHT = 'game_night',
  SPECIAL_EVENT = 'special_event',
  MARKET = 'market',
  SPORTS = 'sports',
  ENTERTAINMENT = 'entertainment',
  PRIVATE_EVENT = 'private_event',
  BREWERY_TOUR = 'brewery_tour',
  TASTING = 'tasting',
  FOOD_PAIRING = 'food_pairing',
  COMMUNITY = 'community',
  SEASONAL = 'seasonal',
  RECURRING = 'recurring',
}

/**
 * Event frequency for recurring events
 */
export enum EventFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEASONAL = 'seasonal',
  ANNUAL = 'annual',
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
  /** Unique event identifier */
  id?: string;
  /** Event title/name */
  title: string;
  /** Event description */
  description?: string;
  /** Event date (ISO 8601 format) */
  date: string;
  /** Start time */
  time: string;
  /** End time (if different from time field) */
  endTime?: string;
  /** Number of expected attendees */
  attendees?: number;
  /** Event website or social media link */
  site?: string;
  /** Event type/category */
  type: EventType;
  /** Event status */
  status: EventStatus;
  /** Location where the event takes place */
  location: Location;
}

/**
 * Brewery event interface (based on CSV schema)
 */
export interface BreweryEvent extends BaseEvent {
  /** Vendor/organizer name */
  vendor: string;
  /** Event end time or duration indicator */
  end?: string | number;
  /** Additional event tags */
  tags?: string[];
  /** Event image URL */
  image?: string;
  /** Whether the event is featured */
  featured?: boolean;
  /** Entry fee or ticket price */
  price?: string;
  /** Age restrictions */
  ageRestriction?: string;
  /** Special requirements or notes */
  requirements?: string[];
}

/**
 * Recurring event pattern
 */
export interface RecurringEventPattern {
  /** Base event information */
  event: Omit<BreweryEvent, 'date'>;
  /** Recurrence frequency */
  frequency: EventFrequency;
  /** Days of the week (for weekly events) */
  daysOfWeek?: number[];
  /** Day of month (for monthly events) */
  dayOfMonth?: number;
  /** Start date for the recurring pattern */
  startDate: string;
  /** End date for the recurring pattern */
  endDate?: string;
  /** Exceptions (dates to skip) */
  exceptions?: string[];
}

/**
 * Event time interface for parsing time strings
 */
export interface EventTime {
  /** Start hour (24-hour format) */
  startHour: number;
  /** Start minute */
  startMinute: number;
  /** End hour (24-hour format) */
  endHour?: number;
  /** End minute */
  endMinute?: number;
  /** Whether time is PM */
  isPM?: boolean;
}

/**
 * Event search and filter interface
 */
export interface EventFilters {
  /** Filter by location */
  location?: Location;
  /** Filter by event type */
  type?: EventType[];
  /** Filter by date range */
  dateRange?: {
    start: string;
    end: string;
  };
  /** Filter by status */
  status?: EventStatus[];
  /** Search by title or description */
  search?: string;
  /** Filter featured events only */
  featuredOnly?: boolean;
  /** Filter free events only */
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

/**
 * Event list response interface
 */
export interface EventList {
  /** List of events */
  events: BreweryEvent[];
  /** Total count */
  total: number;
  /** Applied filters */
  filters?: EventFilters;
  /** Last updated timestamp */
  lastUpdated?: string;
}

/**
 * Event calendar interface for monthly view
 */
export interface EventCalendar {
  /** Year */
  year: number;
  /** Month (1-12) */
  month: number;
  /** Events grouped by date */
  eventsByDate: Record<string, BreweryEvent[]>;
  /** Total events in the month */
  totalEvents: number;
}

/**
 * Event RSVP interface
 */
export interface EventRSVP {
  /** Event ID */
  eventId: string;
  /** User information */
  user: {
    name: string;
    email: string;
    phone?: string;
  };
  /** Number of attendees */
  partySize: number;
  /** RSVP status */
  status: 'yes' | 'no' | 'maybe';
  /** Additional notes */
  notes?: string;
  /** RSVP timestamp */
  timestamp: string;
}

/**
 * Event notification preferences
 */
export interface EventNotificationPreferences {
  /** Notify about new events */
  newEvents: boolean;
  /** Notify about event updates */
  eventUpdates: boolean;
  /** Notify about event cancellations */
  cancellations: boolean;
  /** Event types to notify about */
  eventTypes: EventType[];
  /** Preferred locations */
  locations: Location[];
  /** How far in advance to notify (in hours) */
  advanceNotice: number;
}