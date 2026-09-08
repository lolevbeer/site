/**
 * Public taproom landing page. Same visual language as the homepage location
 * cards, beer catalog grid, and events/food cards — NAP and tap lists stay in
 * the HTML for SEO.
 */
import Link from 'next/link'
import Image from 'next/image'
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { WeeklyHoursTable } from '@/components/location/weekly-hours'
import { formatCityStateZip } from '@/lib/config/locations'
import { getBeerImageUrl, getMediaUrl } from '@/lib/utils/media-utils'
import { getStyleName } from '@/lib/utils/relationship-name'
import { formatDate, formatTime } from '@/lib/utils/formatters'
import { extractVendorInfo, type WeeklyHoursDay } from '@/lib/utils/payload-api'
import { safeHttpUrl } from '@/lib/utils/url-utils'
import type { PayloadLocation } from '@/lib/types/location'
import type { Beer as PayloadBeer, Event as PayloadEvent } from '@/src/payload-types'

type MenuBeer = Pick<PayloadBeer, 'id' | 'name' | 'slug' | 'image' | 'style'>

interface LocationLandingProps {
  location: PayloadLocation
  weeklyHours: WeeklyHoursDay[]
  draftBeers: MenuBeer[]
  canBeers: MenuBeer[]
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

function dateLabel(value: string | Date | undefined | null): string | null {
  if (!value) return null
  const raw = typeof value === 'string' ? value : value.toISOString()
  return formatDate(raw, 'full')
}

function BeerGrid({ beers }: { beers: MenuBeer[] }) {
  return (
    <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-10 list-none p-0 m-0">
      {beers.map((beer, index) => {
        const style = getStyleName(beer.style)
        const href = beer.slug ? `/beer/${beer.slug}` : undefined
        const image = getBeerImageUrl(beer.image, beer.slug ?? undefined)
        return (
          <li key={beer.id}>
            <div className="group relative flex flex-col">
              {image ? (
                <div className="relative h-52 sm:h-60 w-full mb-3 overflow-hidden rounded-lg bg-muted/30">
                  <Image
                    src={image}
                    alt=""
                    fill
                    className="object-contain p-2 transition-transform duration-200 group-hover:scale-[1.03]"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    priority={index < 4}
                  />
                </div>
              ) : null}
              <h3 className="text-xl font-semibold text-center text-balance group-hover:underline underline-offset-4">
                {beer.name}
              </h3>
              {style ? (
                <div className="flex justify-center mt-2">
                  <Badge variant="outline" className="text-xs">
                    {style}
                  </Badge>
                </div>
              ) : null}
              {href ? (
                <Link
                  href={href}
                  className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span className="sr-only">{beer.name}</span>
                </Link>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
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
            <a href={`tel:${phone}`} className="text-muted-foreground hover:text-foreground hover:underline transition-colors">
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
          <p className="text-center text-muted-foreground">
            Check back soon for the current draft list.
          </p>
        ) : (
          <BeerGrid beers={draftBeers} />
        )}
        <div className="text-center mt-10">
          <Button asChild variant="outline" size="lg">
            <Link href="/beer">View all beers</Link>
          </Button>
        </div>
      </section>

      {canBeers.length > 0 ? (
        <section className="mb-16 lg:mb-24">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-12">Cans to go</h2>
          <BeerGrid beers={canBeers} />
        </section>
      ) : null}

      {events.length > 0 ? (
        <section className="mb-16 lg:mb-24">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-12">Upcoming events</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 m-0 mb-8">
            {events.map((event) => {
              const title = event.organizer || 'Event'
              const site = safeHttpUrl(event.site)
              const time = event.startTime || undefined
              const endTime = event.endTime || undefined
              const body = (
                <Card
                  className={`overflow-hidden bg-transparent shadow-none h-full border border-border ${
                    site ? 'hover:bg-secondary transition-colors' : ''
                  }`}
                >
                  <CardContent className="p-6 text-center">
                    <h3 className="text-xl font-semibold mb-2 text-balance">{title}</h3>
                    <div className="space-y-1 text-sm text-muted-foreground flex flex-col items-center">
                      <span>{dateLabel(event.date)}</span>
                      {time && time.toLowerCase() !== 'tbd' ? (
                        <span>
                          {formatTime(time.trim())}
                          {endTime && endTime.toLowerCase() !== 'tbd'
                            ? `–${formatTime(endTime.trim())}`
                            : ''}
                        </span>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              )
              return (
                <li key={event.id}>
                  {site ? (
                    <a href={site} target="_blank" rel="noopener noreferrer" className="block h-full">
                      {body}
                    </a>
                  ) : (
                    body
                  )}
                </li>
              )
            })}
          </ul>
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
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 m-0 mb-8">
            {food.map((entry) => {
              const vendor = extractVendorInfo(entry.vendor, entry.site)
              const logo = vendor.logoUrl
              const site = safeHttpUrl(vendor.site)
              const timeDisplay = entry.time || entry.startTime
              const body = (
                <Card
                  className={`overflow-hidden bg-transparent shadow-none h-full border border-border ${
                    site ? 'hover:bg-secondary transition-colors' : ''
                  }`}
                >
                  <CardContent
                    className={`p-4 ${logo ? 'flex items-center gap-4' : 'text-center py-6'}`}
                  >
                    {logo ? (
                      <div className="relative w-16 h-16 flex-shrink-0 rounded-full overflow-hidden bg-muted">
                        <Image
                          src={logo}
                          alt={`${vendor.name} logo`}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>
                    ) : null}
                    <div className={logo ? 'flex-1 min-w-0 text-left' : ''}>
                      <h3 className="text-xl font-semibold mb-1 text-balance">{vendor.name}</h3>
                      <p className="text-sm text-muted-foreground">{dateLabel(entry.date)}</p>
                      {timeDisplay ? (
                        <p className="text-sm text-muted-foreground">{formatTime(String(timeDisplay))}</p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              )
              return (
                <li key={String(entry.id ?? `${vendor.name}-${entry.date}`)}>
                  {site ? (
                    <a href={site} target="_blank" rel="noopener noreferrer" className="block h-full">
                      {body}
                    </a>
                  ) : (
                    body
                  )}
                </li>
              )
            })}
          </ul>
          <div className="text-center">
            <Button asChild variant="outline" size="lg">
              <Link href="/food">View food schedule</Link>
            </Button>
          </div>
        </section>
      ) : null}

      {otherLocations.length > 0 ? (
        <section className="pt-8 border-t border-border">
          <h2 className="text-2xl font-bold text-center mb-8">
            Our other taproom{otherLocations.length > 1 ? 's' : ''}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-xl mx-auto list-none p-0 m-0">
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
                        loading="eager"
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
