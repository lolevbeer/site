/**
 * Per-taproom landing page. Unique URL for LocalBusiness schema and local search
 * ("Lawrenceville brewery", "Zelienople taproom"). Unknown slugs 404.
 */
import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { JsonLd } from '@/components/seo/json-ld'
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs'
import { PageTransition } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { WeeklyHoursTable } from '@/components/location/weekly-hours'
import { generateLocalBusinessSchema } from '@/lib/utils/local-business-schema'
import { generateLocationMenuSchema } from '@/lib/utils/menu-schema'
import { DEFAULT_OG_IMAGES } from '@/lib/utils/seo'
import { extractBeerFromMenuItem } from '@/lib/utils/menu-item-utils'
import {
  getAllLocations,
  getCansMenu,
  getCombinedUpcomingFood,
  getDraftMenu,
  getUpcomingEventsFromPayload,
  getWeeklyHoursWithHolidays,
  extractVendorInfo,
} from '@/lib/utils/payload-api'
import { findLocationBySlug, RESERVED_LOCATION_SLUGS } from '@/lib/config/locations'
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

function visibleBeersFromMenu(menu: Awaited<ReturnType<typeof getDraftMenu>> | null) {
  return (menu?.items ?? [])
    .map((item) => extractBeerFromMenuItem(item))
    .filter((beer): beer is NonNullable<typeof beer> => beer !== null && !beer.hideFromSite)
}

function BeerNameList({
  beers,
}: {
  beers: Array<{ id: string; name: string; slug?: string | null }>
}) {
  return (
    <ul className="list-disc pl-6 space-y-1">
      {beers.map((beer) => (
        <li key={beer.id}>
          {beer.slug ? (
            <Link href={`/beer/${beer.slug}`} className="hover:underline">
              {beer.name}
            </Link>
          ) : (
            beer.name
          )}
        </li>
      ))}
    </ul>
  )
}

function DateSuffix({ value }: { value: string | Date | undefined | null }) {
  if (!value) return null
  return (
    <span className="text-muted-foreground">
      {' '}
      — {String(value).split('T')[0]}
    </span>
  )
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

  return { location, draftMenu, cansMenu, events, food, weeklyHours }
})

export async function generateMetadata({ params }: LocationPageProps): Promise<Metadata> {
  const { location: slug } = await params
  const data = await loadLocation(slug)
  if (!data) return { title: 'Not Found' }

  const name = data.location.name
  const city = data.location.address?.city
  const title = `${name} Taproom`
  const description = `Visit Lolev Beer in ${name}${city ? `, ${city}` : ''}. Hours, address, what's on tap, and upcoming events.`

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

  const { location, draftMenu, cansMenu, events, food, weeklyHours } = data
  const draftBeers = visibleBeersFromMenu(draftMenu)
  const canBeers = visibleBeersFromMenu(cansMenu)

  const localBusiness = generateLocalBusinessSchema(location, weeklyHours)
  const menuSchema = generateLocationMenuSchema({
    locationName: location.name,
    locationSlug: location.slug || slug,
    draftBeers,
    canBeers,
  })

  const street = location.address?.street
  const cityLine = [location.address?.city, location.address?.state, location.address?.zip]
    .filter(Boolean)
    .join(' ')
  const mapsSearch = street
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${street}, ${cityLine}`)}`
    : undefined
  const directionsUrl = safeHttpUrl(location.address?.directionsUrl) || mapsSearch

  return (
    <>
      <JsonLd data={localBusiness} />
      <JsonLd data={menuSchema} />
      <PageTransition>
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <PageBreadcrumbs className="mb-6" />
          <h1 className="text-4xl font-bold tracking-tight mb-2">Lolev Beer — {location.name}</h1>
          <p className="text-muted-foreground mb-8">
            Craft brewery taproom
            {location.address?.city ? ` in ${location.address.city}` : ''}.
          </p>

          <section className="mb-10 space-y-2">
            <h2 className="text-2xl font-semibold">Address</h2>
            <address className="not-italic space-y-2">
              {street && <p>{street}</p>}
              {cityLine && <p>{cityLine}</p>}
              {location.basicInfo?.phone && (
                <p>
                  <a href={`tel:${location.basicInfo.phone}`} className="hover:underline">
                    {location.basicInfo.phone}
                  </a>
                </p>
              )}
            </address>
            {directionsUrl && (
              <Button asChild className="mt-2">
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
                  Get directions
                  <span className="sr-only"> (opens in Google Maps)</span>
                </a>
              </Button>
            )}
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-3">Hours</h2>
            {weeklyHours.length > 0 ? (
              <WeeklyHoursTable weeklyHours={weeklyHours} variant="card" />
            ) : (
              <p className="text-muted-foreground">Hours not available.</p>
            )}
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-3">On tap now</h2>
            {draftBeers.length === 0 ? (
              <p className="text-muted-foreground">Check back soon for the current draft list.</p>
            ) : (
              <BeerNameList beers={draftBeers} />
            )}
          </section>

          {canBeers.length > 0 && (
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-3">Cans to go</h2>
              <BeerNameList beers={canBeers} />
            </section>
          )}

          {events.length > 0 && (
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-3">Upcoming events</h2>
              <ul className="space-y-2">
                {events.map((event) => (
                  <li key={event.id}>
                    <Link href="/events" className="hover:underline font-medium">
                      {event.organizer}
                    </Link>
                    <DateSuffix value={event.date} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {food.length > 0 && (
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-3">Food</h2>
              <ul className="space-y-2">
                {food.map((entry) => {
                  const vendor = extractVendorInfo(entry.vendor)
                  return (
                    <li key={String(entry.id)}>
                      <Link href="/food" className="hover:underline font-medium">
                        {vendor.name}
                      </Link>
                      <DateSuffix value={entry.date} />
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      </PageTransition>
    </>
  )
}
