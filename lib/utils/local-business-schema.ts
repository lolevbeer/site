/**
 * LocalBusiness schema generation for brewery locations
 * Helps with local SEO, Google Maps, and "near me" searches
 * @see https://schema.org/LocalBusiness
 * @see https://developers.google.com/search/docs/appearance/structured-data/local-business
 */

import type { PayloadLocation } from '@/lib/types/location'
import { extractDayHours, formatHourMinute } from '@/lib/config/locations'
import type { PostalAddressJsonLd, GeoCoordinatesJsonLd } from './json-ld'
import { getMediaUrl } from './media-utils'
import { LOLEV_BASE_URL, SOCIAL_PROFILE_URLS, normalizeLngLat } from './schema-shared'

/** Minimal week-hours row from getWeeklyHoursWithHolidays (avoids importing payload-api). */
export interface SchemaHoursDay {
  day: string
  open: string | null
  close: string | null
  closed: boolean
  timezone?: string
}

/**
 * Schema.org LocalBusiness type
 */
export interface LocalBusinessJsonLd {
  '@context': 'https://schema.org'
  '@type': 'Brewery'
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
  hasMap?: string
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

function groupOpeningHours(
  rows: { day: string; opens: string; closes: string }[],
): OpeningHoursSpecificationJsonLd[] {
  const hoursMap = new Map<string, string[]>()
  for (const row of rows) {
    const key = `${row.opens}-${row.closes}`
    const existing = hoursMap.get(key) || []
    existing.push(row.day)
    hoursMap.set(key, existing)
  }
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
 * Convert day hours to OpeningHoursSpecification in the location timezone.
 * Prefer this week's holiday-aware hours when the caller has them.
 */
function generateOpeningHours(
  location: PayloadLocation,
  weeklyHours?: SchemaHoursDay[],
): OpeningHoursSpecificationJsonLd[] {
  const timezone = location.timezone || 'America/New_York'

  if (weeklyHours && weeklyHours.length > 0) {
    const rows = weeklyHours.flatMap((day) => {
      if (day.closed || !day.open || !day.close) return []
      const tz = day.timezone || timezone
      return [
        {
          day: day.day.charAt(0).toUpperCase() + day.day.slice(1),
          opens: formatHourMinute(day.open, tz),
          closes: formatHourMinute(day.close, tz),
        },
      ]
    })
    return groupOpeningHours(rows)
  }

  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const rows = dayNames.flatMap((day) => {
    const hours = extractDayHours(location, day)
    if (!hours || hours.closed) return []
    return [
      {
        day: day.charAt(0).toUpperCase() + day.slice(1),
        opens: hours.open,
        closes: hours.close,
      },
    ]
  })
  return groupOpeningHours(rows)
}

/**
 * Generate LocalBusiness schema for a brewery location
 */
export function generateLocalBusinessSchema(
  location: PayloadLocation,
  weeklyHours?: SchemaHoursDay[],
): LocalBusinessJsonLd {
  const slug = location.slug || location.id
  const pageUrl = `${LOLEV_BASE_URL}/${slug}`
  const logo = `${LOLEV_BASE_URL}/images/beer/og-image.jpg`

  const images: string[] = [logo]
  const heroImage = getMediaUrl(location.images?.hero)
  const cardImage = getMediaUrl(location.images?.card)
  if (heroImage) images.push(heroImage)
  if (cardImage) images.push(cardImage)

  const schema: LocalBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Brewery',
    '@id': `${LOLEV_BASE_URL}#${slug}`,
    name: `Lolev Beer - ${location.name}`,
    description:
      'Craft brewery serving purposeful beer and building community in the Pittsburgh area. Offering modern ales, expressive lagers, and oak-aged beer.',
    image: images,
    logo,
    url: pageUrl,
    hasMenu: pageUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: location.address?.street || '',
      addressLocality: location.address?.city || '',
      addressRegion: location.address?.state || 'PA',
      postalCode: location.address?.zip || '',
      addressCountry: 'US',
    },
    openingHoursSpecification: generateOpeningHours(location, weeklyHours),
    priceRange: '$$',
    servesCuisine: ['American', 'Beer'],
    acceptsReservations: false,
    currenciesAccepted: 'USD',
    paymentAccepted: 'Cash, Credit Card, Debit Card',
    sameAs: SOCIAL_PROFILE_URLS,
  }

  const lngLat = normalizeLngLat(location.coordinates)
  if (lngLat) {
    const [lng, lat] = lngLat
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: lat,
      longitude: lng,
    }
    schema.hasMap = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  }

  if (location.basicInfo?.phone) {
    schema.telephone = location.basicInfo.phone
  }

  if (location.basicInfo?.email) {
    schema.email = location.basicInfo.email
  }

  return schema
}

/**
 * Generate LocalBusiness schemas for all locations
 */
export function generateLocalBusinessSchemas(
  locations: PayloadLocation[],
  weeklyHoursBySlug?: Record<string, SchemaHoursDay[]>,
): LocalBusinessJsonLd[] {
  return locations
    .filter((loc) => loc.active !== false)
    .map((loc) => generateLocalBusinessSchema(loc, weeklyHoursBySlug?.[loc.slug || loc.id]))
}

/**
 * Generate Organization schema linking all locations
 */
export function generateOrganizationSchema(locations?: PayloadLocation[]): object {
  const baseSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${LOLEV_BASE_URL}#organization`,
    name: 'Lolev Beer',
    alternateName: 'Lolev Beer - A Brewery in Pittsburgh',
    url: LOLEV_BASE_URL,
    logo: `${LOLEV_BASE_URL}/images/beer/og-image.jpg`,
    description:
      'Craft brewery in Pennsylvania. Specializing in modern ales, expressive lagers, and oak-aged beer.',
    foundingDate: '2022',
    email: 'info@lolev.beer',
    sameAs: SOCIAL_PROFILE_URLS,
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
