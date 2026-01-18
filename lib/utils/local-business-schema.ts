/**
 * LocalBusiness schema generation for brewery locations
 * Helps with local SEO, Google Maps, and "near me" searches
 * @see https://schema.org/LocalBusiness
 * @see https://developers.google.com/search/docs/appearance/structured-data/local-business
 */

import type { PayloadLocation } from '@/lib/types/location'
import type { PostalAddressJsonLd, GeoCoordinatesJsonLd } from './json-ld'
import { getMediaUrl } from './formatters'

/**
 * Schema.org LocalBusiness type
 */
export interface LocalBusinessJsonLd {
  '@context': 'https://schema.org'
  '@type': 'BreweryOrDistillery'
  '@id': string
  name: string
  description?: string
  image?: string | string[]
  logo?: string
  url?: string
  telephone?: string
  email?: string
  address: PostalAddressJsonLd
  geo?: GeoCoordinatesJsonLd
  openingHoursSpecification: OpeningHoursSpecificationJsonLd[]
  priceRange?: string
  servesCuisine?: string[]
  hasMenu?: string
  acceptsReservations?: boolean
  currenciesAccepted?: string
  paymentAccepted?: string
  amenityFeature?: AmenityFeatureJsonLd[]
  sameAs?: string[]
  aggregateRating?: AggregateRatingJsonLd
}

export interface OpeningHoursSpecificationJsonLd {
  '@type': 'OpeningHoursSpecification'
  dayOfWeek: string | string[]
  opens: string
  closes: string
}

export interface AmenityFeatureJsonLd {
  '@type': 'LocationFeatureSpecification'
  name: string
  value: boolean
}

export interface AggregateRatingJsonLd {
  '@type': 'AggregateRating'
  ratingValue: string
  reviewCount: string
}

interface DayHours {
  open?: string
  close?: string
}

/**
 * Extract time from ISO string
 */
function parseTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    const hours = date.getUTCHours().toString().padStart(2, '0')
    const minutes = date.getUTCMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  } catch {
    return '00:00'
  }
}

/**
 * Convert day hours to OpeningHoursSpecification
 */
function generateOpeningHours(location: PayloadLocation): OpeningHoursSpecificationJsonLd[] {
  // Group days with same hours
  const hoursMap = new Map<string, string[]>()

  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

  dayNames.forEach((day) => {
    const dayData = location[day as keyof PayloadLocation] as DayHours | undefined
    if (dayData?.open && dayData?.close) {
      const opens = parseTime(dayData.open)
      const closes = parseTime(dayData.close)
      const key = `${opens}-${closes}`
      const existing = hoursMap.get(key) || []
      const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1)
      existing.push(capitalizedDay)
      hoursMap.set(key, existing)
    }
  })

  // Convert to OpeningHoursSpecification array
  return Array.from(hoursMap.entries()).map(([timeRange, days]) => {
    const [opens, closes] = timeRange.split('-')
    return {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: days,
      opens,
      closes,
    }
  })
}

/**
 * Generate LocalBusiness schema for a brewery location
 */
export function generateLocalBusinessSchema(location: PayloadLocation): LocalBusinessJsonLd {
  const slug = location.slug || location.id
  const baseUrl = 'https://lolev.beer'

  // Build images array from CMS data with fallback
  const images: string[] = [`${baseUrl}/images/og-image.png`]
  const heroImage = getMediaUrl(location.images?.hero)
  const cardImage = getMediaUrl(location.images?.card)
  if (heroImage) images.push(heroImage)
  if (cardImage) images.push(cardImage)

  const schema: LocalBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreweryOrDistillery',
    '@id': `${baseUrl}#${slug}`,
    name: `Lolev Beer - ${location.name}`,
    description:
      'Craft brewery serving purposeful beer and building community in the Pittsburgh area. Offering modern ales, expressive lagers, and oak-aged beer.',
    image: images,
    logo: `${baseUrl}/images/og-image.png`,
    url: baseUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: location.address?.street || '',
      addressLocality: location.address?.city || '',
      addressRegion: location.address?.state || 'PA',
      postalCode: location.address?.zip || '',
      addressCountry: 'US',
    },
    openingHoursSpecification: generateOpeningHours(location),
    priceRange: '$$',
    servesCuisine: ['American', 'Beer'],
    acceptsReservations: false,
    currenciesAccepted: 'USD',
    paymentAccepted: 'Cash, Credit Card, Debit Card',
    sameAs: ['https://www.facebook.com/lolevbeer', 'https://www.instagram.com/lolevbeer'],
  }

  // Add geo coordinates if available
  // coordinates is a point field: [longitude, latitude]
  if (location.coordinates && location.coordinates.length === 2) {
    const [lng, lat] = location.coordinates
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: lat,
      longitude: lng,
    }
  }

  // Add telephone if available
  if (location.basicInfo?.phone) {
    schema.telephone = location.basicInfo.phone
  }

  // Add email if available
  if (location.basicInfo?.email) {
    schema.email = location.basicInfo.email
  }

  return schema
}

/**
 * Generate LocalBusiness schemas for all locations
 */
export function generateLocalBusinessSchemas(locations: PayloadLocation[]): LocalBusinessJsonLd[] {
  return locations.filter((loc) => loc.active !== false).map(generateLocalBusinessSchema)
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
    alternateName: 'Lolev Beer - A Brewery in Pittsburgh',
    url: 'https://lolev.beer',
    logo: 'https://lolev.beer/images/og-image.png',
    description:
      'Craft brewery in Pennsylvania. Specializing in modern ales, expressive lagers, and oak-aged beer.',
    foundingDate: '2022',
    email: 'info@lolev.beer',
    sameAs: [
      'https://www.facebook.com/lolevbeer',
      'https://www.instagram.com/lolevbeer',
      'https://twitter.com/lolevbeer',
    ],
  }

  // Add location references if provided
  if (locations && locations.length > 0) {
    const firstLocation = locations.find((loc) => loc.active !== false)
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
          addressCountry: 'US',
        },
        location: locations
          .filter((loc) => loc.active !== false)
          .map((loc) => ({ '@id': `https://lolev.beer#${loc.slug || loc.id}` })),
      }
    }
  }

  return baseSchema
}

/**
 * WebSite schema with SearchAction for Google sitelinks searchbox
 * @see https://schema.org/WebSite
 * @see https://developers.google.com/search/docs/appearance/structured-data/sitelinks-searchbox
 */
export interface WebSiteJsonLd {
  '@context': 'https://schema.org'
  '@type': 'WebSite'
  '@id': string
  name: string
  url: string
  description?: string
  publisher?: { '@id': string }
  potentialAction?: SearchActionJsonLd
}

export interface SearchActionJsonLd {
  '@type': 'SearchAction'
  target: {
    '@type': 'EntryPoint'
    urlTemplate: string
  }
  'query-input': string
}

/**
 * Generate WebSite schema for site identity
 * Links the website to the organization
 */
export function generateWebSiteSchema(): WebSiteJsonLd {
  const baseUrl = 'https://lolev.beer'

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${baseUrl}#website`,
    name: 'Lolev Beer',
    url: baseUrl,
    description: 'Craft brewery in Pittsburgh serving modern ales, expressive lagers, and oak-aged beer.',
    publisher: {
      '@id': `${baseUrl}#organization`
    }
  }
}
