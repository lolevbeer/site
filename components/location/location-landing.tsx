/**
 * Public taproom landing. Reuses homepage location-card, DraftBeerCard, BeerCard,
 * and the food/event agenda so /[location] matches the rest of the site.
 * Draft rows are compact (name and style) — cans keep the catalog tile.
 */
import Link from 'next/link'
import Image from 'next/image'
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FoodSchedule } from '@/components/food/food-schedule'
import { ScheduleList } from '@/components/ui/schedule-list'
import { Beer as BeerIcon } from '@/components/icons'
import { WeeklyHoursTable } from '@/components/location/weekly-hours'
import { DraftBeerCard } from '@/components/beer/draft-beer-card'
import { BeerCard } from '@/components/beer/beer-card'
import { beerHref } from '@/lib/config/beer-filters'
import { formatCityStateZip } from '@/lib/config/locations'
import { getMediaUrl } from '@/lib/utils/media-utils'
import { safeHttpUrl } from '@/lib/utils/url-utils'
import type { WeeklyHoursDay } from '@/lib/utils/payload-api'
import type { Beer } from '@/lib/types/beer'
import type { PayloadLocation } from '@/lib/types/location'
import type { Event as PayloadEvent } from '@/src/payload-types'

interface LocationLandingProps {
  location: PayloadLocation
  weeklyHours: WeeklyHoursDay[]
  draftBeers: Beer[]
  canBeers: Beer[]
  events: PayloadEvent[]
  food: Array<{
    id?: string | number
    vendor: unknown
    date: string | Date
    time?: string | null
    startTime?: string | null
    site?: string | null
  }>
  otherLocations: PayloadLocation[]
  directionsUrl?: string
}

function vendorFields(
  vendor: unknown,
  fallbackSite?: string | null,
): { name: string; site?: string; logoUrl?: string } {
  if (typeof vendor === 'object' && vendor !== null && 'name' in vendor) {
    const v = vendor as { name?: string; site?: string | null; logo?: unknown }
    return {
      name: v.name || 'Vendor',
      site: (fallbackSite || v.site) ?? undefined,
      logoUrl: getMediaUrl(v.logo) ?? undefined,
    }
  }
  return {
    name: String(vendor ?? 'Vendor'),
    site: fallbackSite ?? undefined,
  }
}

export function LocationLanding({
  location,
  weeklyHours,
  draftBeers,
  canBeers,
  events,
  food,
  otherLocations,
  directionsUrl,
}: LocationLandingProps) {
  const street = location.address?.street
  const cityLine = formatCityStateZip(location.address)
  const city = location.address?.city
  const heroSrc = getMediaUrl(location.images?.hero) || getMediaUrl(location.images?.card)
  const phone = location.basicInfo?.phone

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
      <PageBreadcrumbs className="mb-6" />

      <header className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-balance mb-3">
          {location.name}
        </h1>
        <p className="text-muted-foreground text-lg text-pretty">
          Lolev Beer taproom{city ? ` in ${city}` : ''}
        </p>
      </header>

      {heroSrc ? (
        <div className="relative aspect-[16/9] mb-12 overflow-hidden rounded-lg outline outline-1 outline-black/10 dark:outline-white/10 -outline-offset-1">
          <Image
            src={heroSrc}
            alt={`${location.name} taproom`}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 1024px) 100vw, 64rem"
          />
        </div>
      ) : null}

      <section className="grid gap-12 md:grid-cols-2 md:gap-16 mb-16 lg:mb-24">
        <div className="flex flex-col items-center text-center space-y-4">
          <h2 className="text-2xl font-bold">Address</h2>
          <address className="not-italic text-lg text-muted-foreground space-y-1">
            {street ? <p>{street}</p> : null}
            {cityLine ? <p>{cityLine}</p> : null}
          </address>
          {phone ? (
            <a
              href={`tel:${phone}`}
              className="text-muted-foreground hover:text-foreground hover:underline transition-colors"
            >
              {phone}
            </a>
          ) : null}
          {directionsUrl ? (
            <Button asChild className="w-full max-w-xs mt-2">
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
                Get Directions
                <span className="sr-only"> (opens in Google Maps)</span>
              </a>
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col items-center text-center space-y-4">
          <h2 className="text-2xl font-bold">Hours</h2>
          {weeklyHours.length > 0 ? (
            <div className="w-full max-w-xs">
              <WeeklyHoursTable weeklyHours={weeklyHours} variant="card" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Hours not available.</p>
          )}
        </div>
      </section>

      <section className="mb-16 lg:mb-24">
        <h2 className="text-3xl lg:text-4xl font-bold text-center mb-12">On tap now</h2>
        {draftBeers.length === 0 ? (
          <Empty className="border border-dashed border-border/60 rounded-xl p-8 mb-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BeerIcon className="h-6 w-6" />
              </EmptyMedia>
              <EmptyTitle className="text-xl">No beers on draft</EmptyTitle>
              <EmptyDescription className="text-muted-foreground/70">
                Check back soon for the current draft list.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="max-w-2xl mx-auto list-none p-0 m-0 space-y-1 mb-8">
            {draftBeers.map((beer, index) => (
              <li key={`${beer.variant}-${index}`}>
                <DraftBeerCard
                  beer={beer}
                  compact
                  showJustReleased={false}
                  showLocation={false}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="text-center">
          <Button asChild variant="outline" size="lg">
            <Link href={beerHref('tap')}>View all beers</Link>
          </Button>
        </div>
      </section>

      {canBeers.length > 0 ? (
        <section className="mb-16 lg:mb-24">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-12">Cans to go</h2>
          <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 list-none p-0 m-0 mb-8">
            {canBeers.map((beer, index) => (
              <li key={`${beer.variant}-${index}`}>
                <BeerCard
                  beer={beer}
                  variant="minimal"
                  showLocation={false}
                  showCta={false}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {events.length > 0 ? (
        <section className="mb-16 lg:mb-24">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-12">Upcoming events</h2>
          <div className="max-w-2xl mx-auto mb-8">
            <ScheduleList
              items={events.map((event) => {
                const rawDate =
                  typeof event.date === 'string' ? event.date : String(event.date)
                return {
                  id: String(event.id),
                  date: rawDate,
                  title: event.organizer || 'Event',
                  time: event.startTime,
                  endTime: event.endTime,
                  site: safeHttpUrl(event.site),
                }
              })}
            />
          </div>
          <div className="text-center">
            <Button asChild variant="outline" size="lg">
              <Link href="/events">View all events</Link>
            </Button>
          </div>
        </section>
      ) : null}

      {food.length > 0 ? (
        <section className="mb-16 lg:mb-24">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-12">Food</h2>
          <div className="max-w-2xl mx-auto mb-8">
            <FoodSchedule
              items={food.map((entry, index) => {
                const vendor = vendorFields(entry.vendor, entry.site)
                const rawDate =
                  typeof entry.date === 'string' ? entry.date : entry.date.toISOString()
                return {
                  id: String(entry.id ?? `${vendor.name}-${rawDate}-${index}`),
                  date: rawDate,
                  vendor: vendor.name,
                  time: entry.time || entry.startTime,
                  site: safeHttpUrl(vendor.site),
                  logoUrl: vendor.logoUrl,
                }
              })}
            />
          </div>
          <div className="text-center">
            <Button asChild variant="outline" size="lg">
              <Link href="/food">View food schedule</Link>
            </Button>
          </div>
        </section>
      ) : null}

      {otherLocations.length > 0 ? (
        <section>
          <h2 className="text-2xl font-bold text-center mb-8">
            Our other taproom{otherLocations.length > 1 ? 's' : ''}
          </h2>
          <ul
            className={
              otherLocations.length === 1
                ? 'max-w-xs mx-auto list-none p-0 m-0'
                : 'grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-xl mx-auto list-none p-0 m-0'
            }
          >
            {otherLocations.map((other) => {
              const src = getMediaUrl(other.images?.card) || getMediaUrl(other.images?.hero)
              const href = other.slug ? `/${other.slug}` : undefined
              const card = (
                <>
                  {src ? (
                    <div className="relative aspect-video mb-4 overflow-hidden rounded-lg bg-muted">
                      <Image
                        src={src}
                        alt=""
                        fill
                        className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                        sizes="(max-width: 640px) 100vw, 20rem"
                      />
                    </div>
                  ) : null}
                  <p className="text-xl font-bold group-hover:underline underline-offset-4">
                    {other.name}
                  </p>
                </>
              )
              return (
                <li key={other.id} className="text-center">
                  {href ? (
                    <Link href={href} className="group block">
                      {card}
                    </Link>
                  ) : (
                    card
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
