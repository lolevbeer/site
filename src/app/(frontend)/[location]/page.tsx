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
import { findLocationBySlug } from '@/lib/config/locations'

export const revalidate = 300

interface LocationPageProps {
  params: Promise<{ location: string }>
}

export async function generateStaticParams() {
  const locations = await getAllLocations()
  return locations
    .filter((loc) => loc.active !== false && loc.slug)
    .map((loc) => ({ location: loc.slug as string }))
}

const loadLocation = cache(async (slug: string) => {
  const locations = await getAllLocations()
  const location = findLocationBySlug(locations, slug.toLowerCase())
  if (!location || location.active === false) return null

  const [draftMenu, cansMenu, events, food, weeklyHours] = await Promise.all([
    getDraftMenu(slug.toLowerCase()),
    getCansMenu(slug.toLowerCase()),
    getUpcomingEventsFromPayload(slug.toLowerCase(), 5),
    getCombinedUpcomingFood(slug.toLowerCase(), 5),
    getWeeklyHoursWithHolidays(location.id),
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
  const beersFrom = (menu: typeof draftMenu) =>
    (menu?.items ?? [])
      .map((item) => extractBeerFromMenuItem(item))
      .filter((beer): beer is NonNullable<typeof beer> => beer !== null)

  const localBusiness = generateLocalBusinessSchema(location, weeklyHours)
  const menuSchema = generateLocationMenuSchema({
    locationName: location.name,
    locationSlug: location.slug || slug,
    draftBeers: beersFrom(draftMenu),
    canBeers: beersFrom(cansMenu),
  })

  const street = location.address?.street
  const cityLine = [location.address?.city, location.address?.state, location.address?.zip]
    .filter(Boolean)
    .join(' ')
  const directionsUrl =
    location.address?.directionsUrl ||
    (street
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${street}, ${cityLine}`)}`
      : undefined)

  const draftBeers = beersFrom(draftMenu)
  const canBeers = beersFrom(cansMenu)

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
            {street && <p>{street}</p>}
            {cityLine && <p>{cityLine}</p>}
            {location.basicInfo?.phone && (
              <p>
                <a href={`tel:${location.basicInfo.phone}`} className="hover:underline">
                  {location.basicInfo.phone}
                </a>
              </p>
            )}
            {directionsUrl && (
              <Button asChild className="mt-2">
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
                  Get directions
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
              <ul className="list-disc pl-6 space-y-1">
                {draftBeers.map((beer) => (
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
            )}
          </section>

          {canBeers.length > 0 && (
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-3">Cans to go</h2>
              <ul className="list-disc pl-6 space-y-1">
                {canBeers.map((beer) => (
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
                    {event.date && (
                      <span className="text-muted-foreground">
                        {' '}
                        — {event.date.split('T')[0]}
                      </span>
                    )}
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
                      {entry.date && (
                        <span className="text-muted-foreground">
                          {' '}
                          — {String(entry.date).split('T')[0]}
                        </span>
                      )}
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
