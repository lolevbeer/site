/**
 * Public page for one event: /events/<id>, where id is a one-off event's id
 * or a recurring occurrence's `recurring-<definition>-<YYYY-MM-DD>` id.
 *
 * Looks the event up with getPublicEventById (anonymous read, so private and
 * past events miss and the internal description never reaches it). A miss
 * renders not-found.tsx; a database error is not caught, so error.tsx renders
 * and ISR keeps serving the last good page.
 *
 * Shows the name, date and time, the taproom (linked to its page) with its
 * address, the public summary and image, a Tickets/Website link, and the
 * existing "Add to calendar" .ics route, plus Event, breadcrumb and WebPage
 * JSON-LD. The Event JSON-LD url is this page (eventPageUrl).
 */
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllLocations, getPublicEventById } from '@/lib/utils/payload-api'
import { JsonLd } from '@/components/seo/json-ld'
import { PageTransition } from '@/components/motion'
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs'
import { Button } from '@/components/ui/button'
import { createLocationLookup, generateEventJsonLd } from '@/lib/utils/json-ld'
import { generateWebPageSchema } from '@/lib/utils/breadcrumb-schema'
import { buildPageMetadata } from '@/lib/seo/resolve-metadata'
import { ogCardImages } from '@/lib/og/paths'
import { formatAddress, formatDate, formatTimeRange } from '@/lib/utils/formatters'
import { getMediaUrl } from '@/lib/utils/media-utils'
import { isTicketLink, safeHttpUrl } from '@/lib/utils/url-utils'
import type { Event, Location } from '@/src/payload-types'

// ISR: same 5-minute window as /events (the .ics route is CDN-cached by its Cache-Control header).
export const revalidate = 300

/** None at build; each event caches on its first request. Without this, `revalidate` does nothing. */
export function generateStaticParams() {
  return []
}

interface EventPageProps {
  params: Promise<{ id: string }>
}

/** The populated taproom, or null when the relation came back as a bare id. */
function taproomOf(event: Event): Location | null {
  return typeof event.location === 'object' ? event.location : null
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { id } = await params

  // Let Payload/DB errors reach error.tsx instead of looking like a 404.
  const event = await getPublicEventById(id)
  if (!event) return { title: 'Event Not Found' }

  const taproom = taproomOf(event)?.name
  const where = taproom ? ` at ${taproom}` : ''
  return buildPageMetadata({
    fallbackTitle: `${event.organizer}${where}`,
    fallbackDescription:
      event.summary?.trim() || `${event.organizer}${where} on ${formatDate(event.date, 'full')}.`,
    canonicalPath: `/events/${encodeURIComponent(id)}`,
    fallbackOgImages: ogCardImages('event', id, event.organizer),
  })
}

export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params

  // Let Payload/DB errors reach error.tsx instead of looking like a 404.
  const event = await getPublicEventById(id)
  if (!event) notFound()

  const path = `/events/${encodeURIComponent(id)}`
  const taproom = taproomOf(event)
  const address = taproom?.address
    ? formatAddress({
        address: taproom.address.street,
        city: taproom.address.city,
        state: taproom.address.state,
        zip: taproom.address.zip,
      })
    : ''
  const time = formatTimeRange(event.startTime, event.endTime)
  const summary = event.summary?.trim()
  const imageUrl = getMediaUrl(event.image, 'detail')
  const imageAlt = typeof event.image === 'object' ? (event.image?.alt ?? '') : ''
  const site = safeHttpUrl(event.site)

  const eventSchema = generateEventJsonLd(event, createLocationLookup(await getAllLocations()))
  const webPageSchema = generateWebPageSchema({
    name: event.organizer,
    description: summary,
    path,
    dateModified: event.updatedAt,
  })

  return (
    <>
      <JsonLd data={eventSchema} />
      <JsonLd data={webPageSchema} />

      <PageTransition>
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          {/* Also emits the BreadcrumbList JSON-LD. */}
          <PageBreadcrumbs
            className="mb-6"
            customSegments={[
              { label: 'Home', href: '/' },
              { label: 'Events', href: '/events' },
              { label: event.organizer, href: path },
            ]}
          />

          <header className="text-center mb-8">
            <p className="text-sm text-muted-foreground tabular-nums">
              {formatDate(event.date, 'full')}
              {time ? ` · ${time}` : null}
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-balance mt-1">
              {event.organizer}
            </h1>
            {taproom ? (
              <p className="mt-2">
                {taproom.slug ? (
                  <Link
                    href={`/${taproom.slug}`}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {taproom.name}
                  </Link>
                ) : (
                  taproom.name
                )}
              </p>
            ) : null}
            {address ? <p className="text-sm text-muted-foreground">{address}</p> : null}
          </header>

          {imageUrl ? (
            <div className="relative aspect-[16/9] mb-8 overflow-hidden rounded-lg outline outline-1 outline-black/10 dark:outline-white/10 -outline-offset-1">
              <Image
                src={imageUrl}
                alt={imageAlt}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 672px) 100vw, 42rem"
              />
            </div>
          ) : null}

          {summary ? <p className="text-lg text-center text-pretty mb-8">{summary}</p> : null}

          <div className="flex flex-wrap justify-center gap-3">
            {site ? (
              <Button asChild>
                <a href={site} target="_blank" rel="noopener noreferrer">
                  {isTicketLink(site) ? 'Tickets' : 'Website'} <span aria-hidden="true">↗</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              {/* nofollow: one .ics per event has no search value. */}
              <a
                href={`${path}/calendar.ics`}
                rel="nofollow"
                aria-label={`Add ${event.organizer} to calendar`}
              >
                Add to calendar
              </a>
            </Button>
          </div>

          <div className="text-center mt-12">
            <Button asChild variant="link">
              <Link href="/events">All events</Link>
            </Button>
          </div>
        </div>
      </PageTransition>
    </>
  )
}
