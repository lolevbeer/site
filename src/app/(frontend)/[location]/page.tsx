/**
 * Per-taproom landing page. Unique URL for LocalBusiness schema and local search
 * ("Lawrenceville brewery", "Zelienople taproom"). Unknown slugs 404.
 */
import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { JsonLd } from '@/components/seo/json-ld'
import { PageTransition } from '@/components/motion'
import { LocationLanding } from '@/components/location/location-landing'
import { generateLocalBusinessSchema } from '@/lib/utils/local-business-schema'
import { generateLocationMenuSchema } from '@/lib/utils/menu-schema'
import { DEFAULT_OG_IMAGES } from '@/lib/utils/seo'
import { extractBeerFromMenuItem } from '@/lib/utils/menu-item-utils'
import { convertPayloadBeer } from '@/lib/utils/payload-adapter'
import {
  getAllLocations,
  getCansMenu,
  getCombinedUpcomingFood,
  getDraftMenu,
  getUpcomingEventsFromPayload,
  getWeeklyHoursWithHolidays,
} from '@/lib/utils/payload-api'
import { findLocationBySlug, formatCityStateZip, RESERVED_LOCATION_SLUGS } from '@/lib/config/locations'
import { safeHttpUrl } from '@/lib/utils/url-utils'

export const revalidate = 300

interface LocationPageProps {
  params: Promise<{ location: string }>
}

export async function generateStaticParams() {
  const locations = await getAllLocations()
  return locations
    .filter(
      (loc): loc is typeof loc & { slug: string } =>
        loc.active !== false &&
        typeof loc.slug === 'string' &&
        loc.slug.length > 0 &&
        !RESERVED_LOCATION_SLUGS.has(loc.slug),
    )
    .map((loc) => ({ location: loc.slug }))
}

/** Beers on a location menu, including hideFromSite guest taps. Catalog JSON-LD filters those out. */
function beersFromMenu(menu: Awaited<ReturnType<typeof getDraftMenu>> | null) {
  return (menu?.items ?? [])
    .map((item) => extractBeerFromMenuItem(item))
    .filter((beer): beer is NonNullable<typeof beer> => beer !== null)
}

const loadLocation = cache(async (slug: string) => {
  const locations = await getAllLocations()
  const key = slug.toLowerCase()
  if (RESERVED_LOCATION_SLUGS.has(key)) return null
  const location = findLocationBySlug(locations, key)
  if (!location || location.active === false) return null

  const [draftMenu, cansMenu, events, food, weeklyHours] = await Promise.all([
    getDraftMenu(key).catch(() => null),
    getCansMenu(key).catch(() => null),
    getUpcomingEventsFromPayload(key, 5).catch(() => []),
    getCombinedUpcomingFood(key, 5).catch(() => []),
    getWeeklyHoursWithHolidays(location.id).catch(() => []),
  ])

  const otherLocations = locations.filter(
    (loc) =>
      loc.active !== false &&
      loc.slug &&
      loc.slug !== location.slug &&
      !RESERVED_LOCATION_SLUGS.has(loc.slug),
  )

  return { location, draftMenu, cansMenu, events, food, weeklyHours, otherLocations }
})

export async function generateMetadata({ params }: LocationPageProps): Promise<Metadata> {
  const { location: slug } = await params
  const data = await loadLocation(slug)
  if (!data) return { title: 'Not Found' }

  const name = data.location.name
  const city = data.location.address?.city
  const title = `${name} Taproom`
  const place = city && city.toLowerCase() !== name.toLowerCase() ? `${name}, ${city}` : name
  const description = `Visit Lolev Beer in ${place}. Hours, address, what's on tap, and upcoming events.`

  return {
    title,
    description,
    alternates: { canonical: `/${data.location.slug}` },
    openGraph: {
      title: `${title} | Lolev Beer`,
      description,
      type: 'website',
      images: DEFAULT_OG_IMAGES,
    },
  }
}

export default async function LocationPage({ params }: LocationPageProps) {
  const { location: slug } = await params
  const data = await loadLocation(slug)
  if (!data) notFound()

  const { location, draftMenu, cansMenu, events, food, weeklyHours, otherLocations } = data
  const draftPayload = beersFromMenu(draftMenu)
  const canPayload = beersFromMenu(cansMenu).filter((beer) => !beer.hideFromSite)
  const catalogDraft = draftPayload.filter((beer) => !beer.hideFromSite)
  const draftBeers = draftPayload.map(convertPayloadBeer)
  const canBeers = canPayload.map(convertPayloadBeer)

  const localBusiness = generateLocalBusinessSchema(location, weeklyHours)
  const menuSchema = generateLocationMenuSchema({
    locationName: location.name,
    locationSlug: location.slug || slug,
    draftBeers: catalogDraft,
    canBeers: canPayload,
  })

  const street = location.address?.street
  const cityLine = formatCityStateZip(location.address)
  const mapsSearch = street
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${street}, ${cityLine}`)}`
    : undefined
  const directionsUrl = safeHttpUrl(location.address?.directionsUrl) || mapsSearch

  return (
    <>
      <JsonLd data={localBusiness} />
      <JsonLd data={menuSchema} />
      <PageTransition>
        <LocationLanding
          location={location}
          weeklyHours={weeklyHours}
          draftBeers={draftBeers}
          canBeers={canBeers}
          events={events}
          food={food}
          otherLocations={otherLocations}
          directionsUrl={directionsUrl}
        />
      </PageTransition>
    </>
  )
}
