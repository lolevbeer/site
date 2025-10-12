/**
 * LocalBusiness schema generation for brewery locations
 * Helps with local SEO, Google Maps, and "near me" searches
 * @see https://schema.org/LocalBusiness
 * @see https://developers.google.com/search/docs/appearance/structured-data/local-business
 */

import { Location } from '@/lib/types/location';
import { LOCATIONS_DATA, LOCATION_COORDINATES } from '@/lib/config/locations';

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
  geo: GeoCoordinatesJsonLd;
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

/**
 * Convert day hours to OpeningHoursSpecification
 */
function generateOpeningHours(location: Location): OpeningHoursSpecificationJsonLd[] {
  const locationInfo = LOCATIONS_DATA[location];
  const hours = locationInfo.hours;

  // Group days with same hours
  const hoursMap = new Map<string, string[]>();

  const dayNames: Array<keyof typeof hours> = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ];

  dayNames.forEach(day => {
    const dayHours = hours[day];
    if (typeof dayHours !== 'string' && dayHours && !dayHours.closed) {
      const key = `${dayHours.open}-${dayHours.close}`;
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
export function generateLocalBusinessSchema(location: Location): LocalBusinessJsonLd {
  const locationInfo = LOCATIONS_DATA[location];
  const coordinates = LOCATION_COORDINATES[location];
  const locationName = locationInfo.name;
  const baseUrl = 'https://lolev.beer';

  const schema: LocalBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreweryOrDistillery',
    '@id': `${baseUrl}#${location}`,
    name: `Lolev Beer - ${locationName}`,
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

  // Add telephone if available
  if (locationInfo.phone) {
    schema.telephone = locationInfo.phone;
  }

  // Add email if available
  if (locationInfo.email) {
    schema.email = locationInfo.email;
  }

  // Add amenity features based on location features
  if (locationInfo.features && locationInfo.features.length > 0) {
    schema.amenityFeature = locationInfo.features.map(feature => ({
      '@type': 'LocationFeatureSpecification',
      name: feature.replace(/_/g, ' '),
      value: true
    }));
  }

  return schema;
}

/**
 * Generate combined LocalBusiness schema for both locations
 */
export function generateAllLocalBusinessSchemas(): LocalBusinessJsonLd[] {
  return [
    generateLocalBusinessSchema(Location.LAWRENCEVILLE),
    generateLocalBusinessSchema(Location.ZELIENOPLE)
  ];
}

/**
 * Generate Organization schema linking both locations
 */
export function generateOrganizationSchema(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://lolev.beer#organization',
    name: 'Lolev Beer',
    alternateName: 'Love of Learning Brewing Company',
    url: 'https://lolev.beer',
    logo: 'https://lolev.beer/images/og-image.jpg',
    description: 'Craft brewery with locations in Lawrenceville and Zelienople, Pennsylvania. Specializing in modern ales, expressive lagers, and oak-aged beer.',
    foundingDate: '2012',
    email: 'info@lolev.beer',
    telephone: '(412) 336-8965',
    sameAs: [
      'https://www.facebook.com/lolevbeer',
      'https://www.instagram.com/lolevbeer',
      'https://twitter.com/loveoflearningbrewing'
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: '5247 Butler Street',
      addressLocality: 'Pittsburgh',
      addressRegion: 'PA',
      postalCode: '15201',
      addressCountry: 'US'
    },
    location: [
      { '@id': 'https://lolev.beer#lawrenceville' },
      { '@id': 'https://lolev.beer#zelienople' }
    ]
  };
}
