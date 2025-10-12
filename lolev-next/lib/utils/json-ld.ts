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
  switch (status) {
    case EventStatus.SCHEDULED:
      return 'https://schema.org/EventScheduled';
    case EventStatus.CANCELLED:
      return 'https://schema.org/EventCancelled';
    case EventStatus.POSTPONED:
      return 'https://schema.org/EventPostponed';
    case EventStatus.SOLD_OUT:
      return 'https://schema.org/EventScheduled'; // Scheduled but sold out
    case EventStatus.COMPLETED:
      return 'https://schema.org/EventScheduled';
    default:
      return 'https://schema.org/EventScheduled';
  }
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
 * Generate JSON-LD for a BreweryEvent
 */
export function generateEventJsonLd(event: BreweryEvent): EventJsonLd {
  // Validate required fields
  if (!event || !event.title || !event.date) {
    console.warn('Invalid event data for JSON-LD generation', event);
    // Return minimal valid schema
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Event at Lolev Beer',
      startDate: new Date().toISOString(),
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: getLocationPlace(Location.LAWRENCEVILLE),
      organizer: getOrganizer()
    };
  }

  const { startDate, endDate } = toISO8601(event.date, event.time, event.endTime);

  const jsonLd: EventJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description,
    startDate,
    eventStatus: getEventStatus(event.status),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: getLocationPlace(event.location),
    organizer: getOrganizer()
  };

  if (endDate) {
    jsonLd.endDate = endDate;
  }

  if (event.image) {
    jsonLd.image = event.image;
  }

  if (event.site) {
    jsonLd.url = event.site;
  }

  if (event.price) {
    const priceMatch = event.price.match(/\$?(\d+(?:\.\d{2})?)/);
    jsonLd.offers = {
      '@type': 'Offer',
      price: priceMatch ? priceMatch[1] : '0',
      priceCurrency: 'USD',
      availability: event.status === EventStatus.SOLD_OUT
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
      validFrom: new Date().toISOString()
    };
    if (event.site) {
      jsonLd.offers.url = event.site;
    }
  } else {
    // Free event
    jsonLd.offers = {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock'
    };
  }

  // Add performer if it's a music or entertainment event
  if (event.vendor && event.vendor !== event.title) {
    jsonLd.performer = {
      '@type': 'Organization',
      name: event.vendor,
      url: event.site
    };
  }

  return jsonLd;
}

/**
 * Generate JSON-LD for a FoodVendorSchedule (treat as an event)
 */
export function generateFoodEventJsonLd(schedule: FoodVendorSchedule): EventJsonLd {
  // Validate required fields
  if (!schedule || !schedule.vendor || !schedule.date) {
    console.warn('Invalid food schedule data for JSON-LD generation', schedule);
    // Return minimal valid schema
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Food at Lolev Beer',
      startDate: new Date().toISOString(),
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: getLocationPlace(Location.LAWRENCEVILLE),
      organizer: getOrganizer()
    };
  }

  const { startDate, endDate } = toISO8601(schedule.date, schedule.start, schedule.finish);

  // Safely get location name
  const locationInfo = schedule.location ? LOCATIONS_DATA[schedule.location] : null;
  const locationName = locationInfo?.name || 'our location';

  const jsonLd: EventJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `${schedule.vendor} at Lolev Beer`,
    description: schedule.notes || `${schedule.vendor} will be serving food at Lolev Beer ${locationName}`,
    startDate,
    endDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: getLocationPlace(schedule.location),
    organizer: getOrganizer(),
    offers: {
      '@type': 'Offer',
      availability: 'https://schema.org/InStock'
    }
  };

  if (schedule.site) {
    jsonLd.url = schedule.site;
    jsonLd.performer = {
      '@type': 'Organization',
      name: schedule.vendor,
      url: schedule.site
    };
  } else {
    jsonLd.performer = {
      '@type': 'Organization',
      name: schedule.vendor
    };
  }

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
