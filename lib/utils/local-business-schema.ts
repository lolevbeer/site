/**
 * LocalBusiness schema generation for brewery locations
 * Helps with local SEO, Google Maps, and "near me" searches
 * @see https://schema.org/LocalBusiness
 * @see https://developers.google.com/search/docs/appearance/structured-data/local-business
 */

import type { PayloadLocation } from '@/lib/types/location'
import { WEEKDAYS } from '@/lib/types/location'
import { extractDayHours, formatHourMinute } from '@/lib/config/locations'
import {
  geoFromCoordinates,
  postalAddressFromLocation,
  type PostalAddressJsonLd,
  type GeoCoordinatesJsonLd,
} from './json-ld'
import { getMediaUrl } from './media-utils'
import { LOLEV_BASE_URL, LOLEV_OG_IMAGE_URL, SOCIAL_PROFILE_URLS } from './schema-shared'

/** Minimal week-hours row from getWeeklyHoursWithHolidays (avoids importing payload-api). */
export interface SchemaHoursDay {
  day: string
  open: string | null
  close: string | null
  closed: boolean
  timezone?: string
  holidayName?: string
  date?: Date | string
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
  specialOpeningHoursSpecification?: SpecialOpeningHoursSpecificationJsonLd[]
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

export interface SpecialOpeningHoursSpecificationJsonLd {
  '@type': 'OpeningHoursSpecification'
  validFrom: string
  validThrough: string
  opens?: string
  closes?: string
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
    const days = hoursMap.get(key)
    if (days) {
      days.push(row.day)
    } else {
      hoursMap.set(key, [row.day])
    }
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
 * Regular weekly hours from the location document — not this week's holiday
 * overrides, which Google expects on specialOpeningHoursSpecification.
 */
function generateOpeningHours(location: PayloadLocation): OpeningHoursSpecificationJsonLd[] {
  const rows: { day: string; opens: string; closes: string }[] = []
  for (const day of WEEKDAYS) {
    const hours = extractDayHours(location, day)
    if (!hours || hours.closed) continue
    rows.push({
      day: day.charAt(0).toUpperCase() + day.slice(1),
      opens: hours.open,
      closes: hours.close,
    })
  }
  return groupOpeningHours(rows)
}

function toDateKey(value: Date | string): string {
  if (typeof value === 'string') return value.split('T')[0]
  return value.toISOString().split('T')[0]
}

function generateSpecialHours(
  location: PayloadLocation,
  weeklyHours?: SchemaHoursDay[],
): SpecialOpeningHoursSpecificationJsonLd[] {
  if (!weeklyHours?.length) return []
  const timezone = location.timezone || 'America/New_York'
  const specs: SpecialOpeningHoursSpecificationJsonLd[] = []
  for (const day of weeklyHours) {
    if (!day.holidayName || !day.date) continue
    const valid = toDateKey(day.date)
    const spec: SpecialOpeningHoursSpecificationJsonLd = {
      '@type': 'OpeningHoursSpecification',
      validFrom: valid,
      validThrough: valid,
    }
    if (!day.closed && day.open && day.close) {
      const tz = day.timezone || timezone
      spec.opens = formatHourMinute(day.open, tz)
      spec.closes = formatHourMinute(day.close, tz)
    }
    specs.push(spec)
  }
  return specs
}

function locationKey(location: PayloadLocation): string {
  return location.slug || location.id
}

export function generateLocalBusinessSchema(
  location: PayloadLocation,
  weeklyHours?: SchemaHoursDay[],
): LocalBusinessJsonLd {
  const slug = locationKey(location)
  const pageUrl = `${LOLEV_BASE_URL}/${slug}`

  const images: string[] = [LOLEV_OG_IMAGE_URL]
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
    logo: LOLEV_OG_IMAGE_URL,
    url: pageUrl,
    hasMenu: pageUrl,
    address: postalAddressFromLocation(location),
    openingHoursSpecification: generateOpeningHours(location),
    priceRange: '$$',
    servesCuisine: ['American', 'Beer'],
    acceptsReservations: false,
    currenciesAccepted: 'USD',
    paymentAccepted: 'Cash, Credit Card, Debit Card',
    sameAs: SOCIAL_PROFILE_URLS,
  }

  const geo = geoFromCoordinates(location.coordinates)
  if (geo) {
    schema.geo = geo
    schema.hasMap = `https://www.google.com/maps/search/?api=1&query=${geo.latitude},${geo.longitude}`
  }

  const specialHours = generateSpecialHours(location, weeklyHours)
  if (specialHours.length > 0) {
    schema.specialOpeningHoursSpecification = specialHours
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
    .map((loc) => generateLocalBusinessSchema(loc, weeklyHoursBySlug?.[locationKey(loc)]))
}

/**
 * Generate Organization schema linking all locations
 */
export interface OrganizationJsonLd {
  '@context': 'https://schema.org'
  '@type': 'Organization'
  '@id': string
  name: string
  alternateName?: string
  url: string
  logo: string
  description?: string
  foundingDate?: string
  email?: string
  telephone?: string
  sameAs?: string[]
  address?: PostalAddressJsonLd
  location?: Array<{ '@id': string }>
}

export function generateOrganizationSchema(locations?: PayloadLocation[]): OrganizationJsonLd {
  const baseSchema: OrganizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${LOLEV_BASE_URL}#organization`,
    name: 'Lolev Beer',
    alternateName: 'Lolev Beer - A Brewery in Pittsburgh',
    url: LOLEV_BASE_URL,
    logo: LOLEV_OG_IMAGE_URL,
    description:
      'Craft brewery in Pennsylvania. Specializing in modern ales, expressive lagers, and oak-aged beer.',
    foundingDate: '2022',
    email: 'info@lolev.beer',
    sameAs: SOCIAL_PROFILE_URLS,
  }

  const active = locations?.filter((loc) => loc.active !== false) ?? []
  const firstLocation = active[0]
  if (!firstLocation) return baseSchema

  return {
    ...baseSchema,
    telephone: firstLocation.basicInfo?.phone || undefined,
    address: postalAddressFromLocation(firstLocation),
    location: active.map((loc) => ({
      '@id': `${LOLEV_BASE_URL}#${locationKey(loc)}`,
    })),
  }
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
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${LOLEV_BASE_URL}#website`,
    name: 'Lolev Beer',
    url: LOLEV_BASE_URL,
    description: 'Craft brewery in Pittsburgh serving modern ales, expressive lagers, and oak-aged beer.',
    publisher: {
      '@id': `${LOLEV_BASE_URL}#organization`,
    },
  }
}
