/**
 * LocalBusiness schema generation for brewery locations
 * Helps with local SEO, Google Maps, and "near me" searches
 * @see https://schema.org/LocalBusiness
 * @see https://developers.google.com/search/docs/appearance/structured-data/local-business
 */

import type { PayloadLocation } from '@/lib/types/location';

/**
 * Schema.org LocalBusiness type
 */
export interface LocalBusinessJsonLd {
  '@context': 'https://schema.org';
  '@type': 'BreweryOrDistillery';
  '@id': string;
  name: string;
  description?: string;
  image?: string | string[];
  logo?: string;
  url?: string;
  telephone?: string;
  email?: string;
  address: PostalAddressJsonLd;
  geo?: GeoCoordinatesJsonLd;
  openingHoursSpecification: OpeningHoursSpecificationJsonLd[];
  priceRange?: string;
  servesCuisine?: string[];
  hasMenu?: string;
  acceptsReservations?: boolean;
  currenciesAccepted?: string;
  paymentAccepted?: string;
  amenityFeature?: AmenityFeatureJsonLd[];
  sameAs?: string[];
  aggregateRating?: AggregateRatingJsonLd;
}

export interface PostalAddressJsonLd {
  '@type': 'PostalAddress';
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
}

export interface GeoCoordinatesJsonLd {
  '@type': 'GeoCoordinates';
  latitude: number;
  longitude: number;
}

export interface OpeningHoursSpecificationJsonLd {
  '@type': 'OpeningHoursSpecification';
  dayOfWeek: string | string[];
  opens: string;
  closes: string;
}

export interface AmenityFeatureJsonLd {
  '@type': 'LocationFeatureSpecification';
  name: string;
  value: boolean;
}

export interface AggregateRatingJsonLd {
  '@type': 'AggregateRating';
  ratingValue: string;
  reviewCount: string;
}

interface DayHours {
  open?: string;
  close?: string;
}

/**
 * Extract time from ISO string
 */
function parseTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '00:00';
  }
}

/**
 * Convert day hours to OpeningHoursSpecification
 */
function generateOpeningHours(location: PayloadLocation): OpeningHoursSpecificationJsonLd[] {
  // Group days with same hours
  const hoursMap = new Map<string, string[]>();

  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  dayNames.forEach(day => {
    const dayData = location[day as keyof PayloadLocation] as DayHours | undefined;
    if (dayData?.open && dayData?.close) {
      const opens = parseTime(dayData.open);
      const closes = parseTime(dayData.close);
      const key = `${opens}-${closes}`;
      const existing = hoursMap.get(key) || [];
      const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);
      existing.push(capitalizedDay);
      hoursMap.set(key, existing);
    }
  });

  // Convert to OpeningHoursSpecification array
  return Array.from(hoursMap.entries()).map(([timeRange, days]) => {
    const [opens, closes] = timeRange.split('-');
    return {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: days,
      opens,
      closes
    };
  });
}

/**
 * Generate LocalBusiness schema for a brewery location
 */
export function generateLocalBusinessSchema(location: PayloadLocation): LocalBusinessJsonLd {
  const slug = location.slug || location.id;
  const baseUrl = 'https://lolev.beer';

  const schema: LocalBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreweryOrDistillery',
    '@id': `${baseUrl}#${slug}`,
    name: `Lolev Beer - ${location.name}`,
    description: 'Craft brewery serving purposeful beer and building community in the Pittsburgh area. Offering modern ales, expressive lagers, and oak-aged beer.',
    image: [
      `${baseUrl}/images/og-image.jpg`,
      `${baseUrl}/images/bar.jpg`,
      `${baseUrl}/images/fermentors.jpg`
    ],
    logo: `${baseUrl}/images/og-image.jpg`,
    url: baseUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: location.address?.street || '',
      addressLocality: location.address?.city || '',
      addressRegion: location.address?.state || 'PA',
      postalCode: location.address?.zip || '',
      addressCountry: 'US'
    },
    openingHoursSpecification: generateOpeningHours(location),
    priceRange: '$$',
    servesCuisine: ['American', 'Beer'],
    acceptsReservations: false,
    currenciesAccepted: 'USD',
    paymentAccepted: 'Cash, Credit Card, Debit Card',
    sameAs: [
      'https://www.facebook.com/lolevbeer',
      'https://www.instagram.com/lolevbeer'
    ]
  };

  // Add geo coordinates if available
  if (location.coordinates?.latitude && location.coordinates?.longitude) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: location.coordinates.latitude,
      longitude: location.coordinates.longitude
    };
  }

  // Add telephone if available
  if (location.basicInfo?.phone) {
    schema.telephone = location.basicInfo.phone;
  }

  // Add email if available
  if (location.basicInfo?.email) {
    schema.email = location.basicInfo.email;
  }

  return schema;
}

/**
 * Generate LocalBusiness schemas for all locations
 */
export function generateLocalBusinessSchemas(locations: PayloadLocation[]): LocalBusinessJsonLd[] {
  return locations
    .filter(loc => loc.active !== false)
    .map(generateLocalBusinessSchema);
}

/**
 * Generate Organization schema linking all locations
 */
export function generateOrganizationSchema(locations?: PayloadLocation[]): object {
  const baseSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://lolev.beer#organization',
    name: 'Lolev Beer',
    alternateName: 'Love of Learning Brewing Company',
    url: 'https://lolev.beer',
    logo: 'https://lolev.beer/images/og-image.jpg',
    description: 'Craft brewery in Pennsylvania. Specializing in modern ales, expressive lagers, and oak-aged beer.',
    foundingDate: '2012',
    email: 'info@lolev.beer',
    sameAs: [
      'https://www.facebook.com/lolevbeer',
      'https://www.instagram.com/lolevbeer',
      'https://twitter.com/loveoflearningbrewing'
    ]
  };

  // Add location references if provided
  if (locations && locations.length > 0) {
    const firstLocation = locations.find(loc => loc.active !== false);
    if (firstLocation) {
      return {
        ...baseSchema,
        telephone: firstLocation.basicInfo?.phone || '(412) 336-8965',
        address: {
          '@type': 'PostalAddress',
          streetAddress: firstLocation.address?.street || '',
          addressLocality: firstLocation.address?.city || '',
          addressRegion: firstLocation.address?.state || 'PA',
          postalCode: firstLocation.address?.zip || '',
          addressCountry: 'US'
        },
        location: locations
          .filter(loc => loc.active !== false)
          .map(loc => ({ '@id': `https://lolev.beer#${loc.slug || loc.id}` }))
      };
    }
  }

  return baseSchema;
}
