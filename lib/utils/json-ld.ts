/**
 * JSON-LD structured data utilities for SEO
 * Generates schema.org compliant structured data for events and other content
 * @see https://developers.google.com/search/docs/appearance/structured-data/event
 */

import { BreweryEvent, EventStatus } from '@/lib/types/event';
import { FoodVendorSchedule } from '@/lib/types/food';
import type { LocationSlug, PayloadLocation } from '@/lib/types/location';
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
 * Get location Place data for JSON-LD from PayloadLocation
 */
function getLocationPlaceFromPayload(location: PayloadLocation): PlaceJsonLd {
  const place: PlaceJsonLd = {
    '@type': 'Place',
    name: `Lolev Beer - ${location.name}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: location.address?.street || '',
      addressLocality: location.address?.city || '',
      addressRegion: location.address?.state || 'PA',
      postalCode: location.address?.zip || '',
      addressCountry: 'US'
    }
  };

  // coordinates is a point field: [longitude, latitude]
  if (location.coordinates && location.coordinates.length === 2) {
    const [lng, lat] = location.coordinates;
    place.geo = {
      '@type': 'GeoCoordinates',
      latitude: lat,
      longitude: lng
    };
  }

  if (location.basicInfo?.phone) {
    place.telephone = location.basicInfo.phone;
  }

  return place;
}

/**
 * Get a default place for when no location is available
 */
function getDefaultPlace(): PlaceJsonLd {
  return {
    '@type': 'Place',
    name: 'Lolev Beer',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '',
      addressLocality: '',
      addressRegion: 'PA',
      postalCode: '',
      addressCountry: 'US'
    }
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
    logo: 'https://lolev.beer/images/og-image.png',
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
  const statusMap: Partial<Record<EventStatus, string>> = {
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
  if (!match) return { hours: 18, minutes: 0 };

  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2] || '0');
  const meridiem = match[3]?.toLowerCase();

  if (meridiem === 'pm' && hours !== 12) hours += 12;
  else if (meridiem === 'am' && hours === 12) hours = 0;
  else if (!meridiem && hours < 12) hours += 12;

  return { hours, minutes };
}

/**
 * Convert date and time to ISO 8601 format
 */
function toISO8601(date: string, time?: string, endTime?: string): { startDate: string; endDate?: string } {
  const eventDate = parseLocalDate(date);

  if (!time) return { startDate: eventDate.toISOString().split('T')[0] };

  const { hours, minutes } = parseTime(time);
  eventDate.setHours(hours, minutes, 0, 0);

  const result = { startDate: eventDate.toISOString(), endDate: undefined as string | undefined };

  if (endTime) {
    const endEventDate = new Date(eventDate);
    const { hours: endHours, minutes: endMinutes } = parseTime(endTime);
    endEventDate.setHours(endHours, endMinutes, 0, 0);
    result.endDate = endEventDate.toISOString();
  }

  return result;
}

/**
 * Location lookup map for JSON-LD generation
 */
type LocationLookup = Map<LocationSlug, PayloadLocation>;

/**
 * Create base event JSON-LD structure with common fields
 */
function createBaseEventJsonLd(
  name: string,
  locationSlug: LocationSlug | undefined,
  locationLookup: LocationLookup,
  startDate = new Date().toISOString()
): EventJsonLd {
  const location = locationSlug ? locationLookup.get(locationSlug) : undefined;
  const place = location ? getLocationPlaceFromPayload(location) : getDefaultPlace();

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    startDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: place,
    organizer: getOrganizer()
  };
}

/**
 * Payload Event format (from Events collection)
 */
interface PayloadEvent {
  organizer: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: { slug?: string; id?: string } | string;
  site?: string;
  description?: string;
}

/**
 * Generate JSON-LD for a BreweryEvent or Payload Event
 * @param event - The event data
 * @param locationLookup - Map of location slugs to PayloadLocation objects
 */
export function generateEventJsonLd(
  event: BreweryEvent | PayloadEvent,
  locationLookup: LocationLookup = new Map()
): EventJsonLd {
  // Check if it's a Payload event (has organizer field instead of title)
  const isPayloadEvent = 'organizer' in event && !('title' in event);

  if (isPayloadEvent) {
    const payloadEvent = event as PayloadEvent;
    if (!payloadEvent.organizer || !payloadEvent.date) {
      console.warn('Invalid Payload event data for JSON-LD generation', event);
      return createBaseEventJsonLd('Event at Lolev Beer', undefined, locationLookup);
    }

    // Extract location slug from relationship
    const locationSlug = typeof payloadEvent.location === 'object'
      ? (payloadEvent.location?.slug || payloadEvent.location?.id) as LocationSlug | undefined
      : payloadEvent.location as LocationSlug | undefined;

    const { startDate, endDate } = toISO8601(
      payloadEvent.date,
      payloadEvent.startTime,
      payloadEvent.endTime
    );

    const jsonLd = createBaseEventJsonLd(
      payloadEvent.organizer,
      locationSlug,
      locationLookup,
      startDate
    );

    jsonLd.startDate = startDate;
    if (endDate) jsonLd.endDate = endDate;
    if (payloadEvent.description) jsonLd.description = payloadEvent.description;
    if (payloadEvent.site) jsonLd.url = payloadEvent.site;
    jsonLd.offers = { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' };

    return jsonLd;
  }

  // BreweryEvent handling
  const breweryEvent = event as BreweryEvent;
  if (!breweryEvent || !breweryEvent.title || !breweryEvent.date) {
    console.warn('Invalid event data for JSON-LD generation', event);
    return createBaseEventJsonLd('Event at Lolev Beer', undefined, locationLookup);
  }

  const { startDate, endDate } = toISO8601(breweryEvent.date, breweryEvent.time, breweryEvent.endTime);
  const jsonLd = createBaseEventJsonLd(breweryEvent.title, breweryEvent.location, locationLookup);

  jsonLd.description = breweryEvent.description;
  jsonLd.startDate = startDate;
  jsonLd.eventStatus = getEventStatus(breweryEvent.status);
  if (endDate) jsonLd.endDate = endDate;
  if (breweryEvent.image) jsonLd.image = breweryEvent.image;
  if (breweryEvent.site) jsonLd.url = breweryEvent.site;

  // Add offers
  if (breweryEvent.price) {
    const priceMatch = breweryEvent.price.match(/\$?(\d+(?:\.\d{2})?)/);
    jsonLd.offers = {
      '@type': 'Offer',
      price: priceMatch ? priceMatch[1] : '0',
      priceCurrency: 'USD',
      availability: breweryEvent.status === EventStatus.SOLD_OUT ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      validFrom: new Date().toISOString(),
      ...(breweryEvent.site && { url: breweryEvent.site })
    };
  } else {
    jsonLd.offers = { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' };
  }

  // Add performer if it's a music or entertainment event
  if (breweryEvent.vendor && breweryEvent.vendor !== breweryEvent.title) {
    jsonLd.performer = { '@type': 'Organization', name: breweryEvent.vendor, url: breweryEvent.site };
  }

  return jsonLd;
}

/**
 * Payload Food format (from Food collection or RecurringFood expansion)
 */
interface PayloadFoodData {
  vendor?: { id?: string; name?: string; site?: string | null } | string;
  vendorName?: string;
  date: string;
  location?: { slug?: string; id?: string } | string;
  startTime?: string;
  isRecurring?: boolean;
}

/**
 * Generate JSON-LD for food vendor schedule (treats as an event)
 * @param schedule - The food schedule data (Payload format or FoodVendorSchedule)
 * @param locationLookup - Map of location slugs to PayloadLocation objects
 */
export function generateFoodEventJsonLd(
  schedule: FoodVendorSchedule | PayloadFoodData,
  locationLookup: LocationLookup = new Map()
): EventJsonLd {
  // Check if it's Payload food data (has vendor as object or vendorName)
  const isPayloadFood = typeof (schedule as PayloadFoodData).vendor === 'object' ||
    'vendorName' in schedule ||
    'isRecurring' in schedule;

  if (isPayloadFood) {
    const payloadFood = schedule as PayloadFoodData;

    // Extract vendor name from either vendor object or vendorName field
    const vendorName = typeof payloadFood.vendor === 'object'
      ? payloadFood.vendor?.name
      : payloadFood.vendorName || 'Food Vendor';

    const vendorSite = typeof payloadFood.vendor === 'object'
      ? payloadFood.vendor?.site || undefined
      : undefined;

    if (!vendorName || !payloadFood.date) {
      console.warn('Invalid Payload food data for JSON-LD generation', schedule);
      return createBaseEventJsonLd('Food at Lolev Beer', undefined, locationLookup);
    }

    // Extract location slug from relationship
    const locationSlug = typeof payloadFood.location === 'object'
      ? (payloadFood.location?.slug || payloadFood.location?.id) as LocationSlug | undefined
      : payloadFood.location as LocationSlug | undefined;

    const { startDate } = toISO8601(payloadFood.date, payloadFood.startTime);

    const jsonLd = createBaseEventJsonLd(
      `${vendorName} at Lolev Beer`,
      locationSlug,
      locationLookup,
      startDate
    );

    jsonLd.startDate = startDate;
    jsonLd.offers = { '@type': 'Offer', availability: 'https://schema.org/InStock' };
    jsonLd.performer = vendorSite
      ? { '@type': 'Organization', name: vendorName, url: vendorSite }
      : { '@type': 'Organization', name: vendorName };
    if (vendorSite) jsonLd.url = vendorSite;

    return jsonLd;
  }

  // FoodVendorSchedule handling (legacy format)
  const foodSchedule = schedule as FoodVendorSchedule;
  if (!foodSchedule.vendor || !foodSchedule.date) {
    console.warn('Invalid food schedule data for JSON-LD generation', foodSchedule);
    return createBaseEventJsonLd('Food at Lolev Beer', undefined, locationLookup);
  }

  const { startDate, endDate } = toISO8601(foodSchedule.date, foodSchedule.start, foodSchedule.finish);
  const location = foodSchedule.location ? locationLookup.get(foodSchedule.location) : undefined;
  const locationName = location?.name || 'our location';
  const jsonLd = createBaseEventJsonLd(
    `${foodSchedule.vendor} at Lolev Beer`,
    foodSchedule.location,
    locationLookup
  );

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
 * @param events - Array of events
 * @param locationLookup - Map of location slugs to PayloadLocation objects
 */
export function generateEventListJsonLd(
  events: BreweryEvent[],
  locationLookup: LocationLookup = new Map()
): object {
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
      item: generateEventJsonLd(event, locationLookup)
    }))
  };
}

/**
 * Create a location lookup map from an array of PayloadLocations
 */
export function createLocationLookup(locations: PayloadLocation[]): LocationLookup {
  return new Map(locations.map(loc => [loc.slug || loc.id, loc]));
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
