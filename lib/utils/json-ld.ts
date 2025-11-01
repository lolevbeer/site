/**
 * JSON-LD structured data utilities for SEO
 * Generates schema.org compliant structured data for events and other content
 * @see https://developers.google.com/search/docs/appearance/structured-data/event
 */

import { BreweryEvent, EventStatus } from '@/lib/types/event';
import { FoodVendorSchedule } from '@/lib/types/food';
import { Location } from '@/lib/types/location';
import { LOCATIONS_DATA, LOCATION_COORDINATES } from '@/lib/config/locations';
import { parseLocalDate } from './formatters';

/**
 * Schema.org Event type
 * @see https://schema.org/Event
 */
export interface EventJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Event';
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  eventStatus: string;
  eventAttendanceMode: string;
  location: PlaceJsonLd;
  organizer: OrganizationJsonLd;
  offers?: OfferJsonLd;
  image?: string | string[];
  performer?: PersonOrOrganizationJsonLd;
  url?: string;
}

/**
 * Schema.org Place type
 * @see https://schema.org/Place
 */
export interface PlaceJsonLd {
  '@type': 'Place';
  name: string;
  address: PostalAddressJsonLd;
  geo?: GeoCoordinatesJsonLd;
  telephone?: string;
}

/**
 * Schema.org PostalAddress type
 * @see https://schema.org/PostalAddress
 */
export interface PostalAddressJsonLd {
  '@type': 'PostalAddress';
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
}

/**
 * Schema.org GeoCoordinates type
 * @see https://schema.org/GeoCoordinates
 */
export interface GeoCoordinatesJsonLd {
  '@type': 'GeoCoordinates';
  latitude: number;
  longitude: number;
}

/**
 * Schema.org Organization type
 * @see https://schema.org/Organization
 */
export interface OrganizationJsonLd {
  '@type': 'Organization';
  name: string;
  url?: string;
  logo?: string;
  sameAs?: string[];
}

/**
 * Schema.org Person or Organization type
 */
export interface PersonOrOrganizationJsonLd {
  '@type': 'Person' | 'Organization';
  name: string;
  url?: string;
}

/**
 * Schema.org Offer type
 * @see https://schema.org/Offer
 */
export interface OfferJsonLd {
  '@type': 'Offer';
  url?: string;
  price?: string;
  priceCurrency?: string;
  availability?: string;
  validFrom?: string;
}

/**
 * Get location Place data for JSON-LD
 */
function getLocationPlace(location: Location): PlaceJsonLd {
  // Default to Lawrenceville if location is invalid
  const validLocation = location || Location.LAWRENCEVILLE;
  const locationInfo = LOCATIONS_DATA[validLocation];
  const coordinates = LOCATION_COORDINATES[validLocation];

  // Fallback in case location data is still missing
  if (!locationInfo) {
    return {
      '@type': 'Place',
      name: 'Lolev Beer',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '5247 Butler Street',
        addressLocality: 'Pittsburgh',
        addressRegion: 'PA',
        postalCode: '15201',
        addressCountry: 'US'
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 40.4649,
        longitude: -79.9603
      }
    };
  }

  return {
    '@type': 'Place',
    name: `Lolev Beer - ${locationInfo.name}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: locationInfo.address,
      addressLocality: locationInfo.city,
      addressRegion: locationInfo.state,
      postalCode: locationInfo.zipCode,
      addressCountry: 'US'
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: coordinates.lat,
      longitude: coordinates.lng
    },
    telephone: locationInfo.phone
  };
}

/**
 * Get organizer data for JSON-LD
 */
function getOrganizer(): OrganizationJsonLd {
  return {
    '@type': 'Organization',
    name: 'Lolev Beer',
    url: 'https://lolev.beer',
    logo: 'https://lolev.beer/images/og-image.jpg',
    sameAs: [
      'https://www.facebook.com/lolevbeer',
      'https://www.instagram.com/lolevbeer'
    ]
  };
}

/**
 * Convert event status to schema.org EventStatus
 */
function getEventStatus(status: EventStatus): string {
  const statusMap: Record<EventStatus, string> = {
    [EventStatus.CANCELLED]: 'https://schema.org/EventCancelled',
    [EventStatus.POSTPONED]: 'https://schema.org/EventPostponed',
    [EventStatus.SCHEDULED]: 'https://schema.org/EventScheduled',
    [EventStatus.SOLD_OUT]: 'https://schema.org/EventScheduled',
    [EventStatus.COMPLETED]: 'https://schema.org/EventScheduled',
    [EventStatus.DRAFT]: 'https://schema.org/EventScheduled',
  };
  return statusMap[status] || 'https://schema.org/EventScheduled';
}

/**
 * Parse time string to hours and minutes
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const match = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return { hours: 18, minutes: 0 }; // Default to 6pm

  let hours = parseInt(match[1]);
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();

  // Convert to 24-hour format
  if (meridiem === 'pm' && hours !== 12) {
    hours += 12;
  } else if (meridiem === 'am' && hours === 12) {
    hours = 0;
  } else if (!meridiem && hours < 12) {
    // Assume PM for times without meridiem if less than 12
    hours += 12;
  }

  return { hours, minutes };
}

/**
 * Convert date and time to ISO 8601 format
 */
function toISO8601(date: string, time?: string, endTime?: string): { startDate: string; endDate?: string } {
  const eventDate = parseLocalDate(date);

  if (!time) {
    // If no time specified, use the date only
    return {
      startDate: eventDate.toISOString().split('T')[0]
    };
  }

  const { hours, minutes } = parseTime(time);
  eventDate.setHours(hours, minutes, 0, 0);

  const startDate = eventDate.toISOString();
  let endDateStr: string | undefined;

  if (endTime) {
    const endEventDate = new Date(eventDate);
    const endParsed = parseTime(endTime);
    endEventDate.setHours(endParsed.hours, endParsed.minutes, 0, 0);
    endDateStr = endEventDate.toISOString();
  }

  return {
    startDate,
    endDate: endDateStr
  };
}

/**
 * CSV Event data structure (from beer-data.ts)
 */
interface CSVEvent {
  date: string;
  vendor: string;
  time?: string;
  attendees?: string;
  site?: string;
  end?: string;
  location?: Location; // Added to track which location
}

/**
 * CSV Food data structure (from beer-data.ts)
 */
interface CSVFood {
  vendor: string;
  date: string;
  time?: string;
  site?: string;
  day?: string;
  location?: Location; // Added to track which location
}

/**
 * Create base event JSON-LD structure with common fields
 */
function createBaseEventJsonLd(name: string, location: Location): EventJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    startDate: new Date().toISOString(),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: getLocationPlace(location),
    organizer: getOrganizer()
  };
}

/**
 * Generate JSON-LD for a BreweryEvent or CSV Event
 */
export function generateEventJsonLd(event: BreweryEvent | CSVEvent): EventJsonLd {
  // Check if it's a CSV event (has vendor instead of title)
  const isCSVEvent = 'vendor' in event && !('title' in event);

  if (isCSVEvent) {
    const csvEvent = event as CSVEvent;
    const { startDate, endDate } = toISO8601(csvEvent.date, csvEvent.time, csvEvent.end);
    const jsonLd = createBaseEventJsonLd(csvEvent.vendor || 'Event at Lolev Beer', csvEvent.location || Location.LAWRENCEVILLE);

    jsonLd.startDate = startDate;
    if (endDate) jsonLd.endDate = endDate;
    if (csvEvent.site) {
      jsonLd.url = csvEvent.site;
      jsonLd.performer = { '@type': 'Organization', name: csvEvent.vendor, url: csvEvent.site };
    } else if (csvEvent.vendor) {
      jsonLd.performer = { '@type': 'Organization', name: csvEvent.vendor };
    }

    return jsonLd;
  }

  // Original BreweryEvent handling
  if (!event || !event.title || !event.date) {
    console.warn('Invalid event data for JSON-LD generation', event);
    return createBaseEventJsonLd('Event at Lolev Beer', Location.LAWRENCEVILLE);
  }

  const { startDate, endDate } = toISO8601(event.date, event.time, event.endTime);
  const jsonLd = createBaseEventJsonLd(event.title, event.location);

  jsonLd.description = event.description;
  jsonLd.startDate = startDate;
  jsonLd.eventStatus = getEventStatus(event.status);
  if (endDate) jsonLd.endDate = endDate;
  if (event.image) jsonLd.image = event.image;
  if (event.site) jsonLd.url = event.site;

  // Add offers
  if (event.price) {
    const priceMatch = event.price.match(/\$?(\d+(?:\.\d{2})?)/);
    jsonLd.offers = {
      '@type': 'Offer',
      price: priceMatch ? priceMatch[1] : '0',
      priceCurrency: 'USD',
      availability: event.status === EventStatus.SOLD_OUT ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      validFrom: new Date().toISOString(),
      ...(event.site && { url: event.site })
    };
  } else {
    jsonLd.offers = { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' };
  }

  // Add performer if it's a music or entertainment event
  if (event.vendor && event.vendor !== event.title) {
    jsonLd.performer = { '@type': 'Organization', name: event.vendor, url: event.site };
  }

  return jsonLd;
}

/**
 * Generate JSON-LD for a FoodVendorSchedule or CSV Food (treat as an event)
 */
export function generateFoodEventJsonLd(schedule: FoodVendorSchedule | CSVFood): EventJsonLd {
  // Check if it's CSV food data (simpler structure)
  const isCSVFood = 'day' in schedule || (!('start' in schedule) && !('finish' in schedule));

  if (isCSVFood) {
    const csvFood = schedule as CSVFood;
    if (!csvFood.vendor || !csvFood.date) {
      console.warn('Invalid CSV food data for JSON-LD generation', csvFood);
      return createBaseEventJsonLd('Food at Lolev Beer', Location.LAWRENCEVILLE);
    }

    const { startDate } = toISO8601(csvFood.date, csvFood.time);
    const jsonLd = createBaseEventJsonLd(`${csvFood.vendor} at Lolev Beer`, csvFood.location || Location.LAWRENCEVILLE);

    jsonLd.startDate = startDate;
    jsonLd.offers = { '@type': 'Offer', availability: 'https://schema.org/InStock' };
    jsonLd.performer = csvFood.site
      ? { '@type': 'Organization', name: csvFood.vendor, url: csvFood.site }
      : { '@type': 'Organization', name: csvFood.vendor };
    if (csvFood.site) jsonLd.url = csvFood.site;

    return jsonLd;
  }

  // Original FoodVendorSchedule handling
  const foodSchedule = schedule as FoodVendorSchedule;
  if (!foodSchedule.vendor || !foodSchedule.date) {
    console.warn('Invalid food schedule data for JSON-LD generation', foodSchedule);
    return createBaseEventJsonLd('Food at Lolev Beer', Location.LAWRENCEVILLE);
  }

  const { startDate, endDate } = toISO8601(foodSchedule.date, foodSchedule.start, foodSchedule.finish);
  const locationInfo = foodSchedule.location ? LOCATIONS_DATA[foodSchedule.location] : null;
  const locationName = locationInfo?.name || 'our location';
  const jsonLd = createBaseEventJsonLd(`${foodSchedule.vendor} at Lolev Beer`, foodSchedule.location);

  jsonLd.description = foodSchedule.notes || `${foodSchedule.vendor} will be serving food at Lolev Beer ${locationName}`;
  jsonLd.startDate = startDate;
  if (endDate) jsonLd.endDate = endDate;
  jsonLd.offers = { '@type': 'Offer', availability: 'https://schema.org/InStock' };
  jsonLd.performer = foodSchedule.site
    ? { '@type': 'Organization', name: foodSchedule.vendor, url: foodSchedule.site }
    : { '@type': 'Organization', name: foodSchedule.vendor };
  if (foodSchedule.site) jsonLd.url = foodSchedule.site;

  return jsonLd;
}

/**
 * Generate multiple events as an ItemList
 * Useful for event listing pages
 */
export function generateEventListJsonLd(events: BreweryEvent[]): object {
  // Filter out invalid events
  const validEvents = events.filter(event => event && event.title && event.date && event.location);

  if (validEvents.length === 0) {
    console.warn('No valid events for JSON-LD ItemList generation');
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: []
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: validEvents.map((event, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: generateEventJsonLd(event)
    }))
  };
}

/**
 * Serialize JSON-LD to script tag content
 */
export function serializeJsonLd(jsonLd: object): string {
  return JSON.stringify(jsonLd, null, 0);
}

/**
 * Generate script tag for embedding JSON-LD in HTML
 */
export function generateJsonLdScript(jsonLd: object): string {
  return `<script type="application/ld+json">${serializeJsonLd(jsonLd)}</script>`;
}
