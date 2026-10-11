/**
 * Per-event "Add to calendar" download: /events/<id>/calendar.ics.
 * Looks the id up in the same cached public upcoming-events list /events
 * renders (anonymous read, so private events and the internal description
 * never reach it) and returns a single-VEVENT iCalendar file.
 */
import { NextRequest } from 'next/server'
import { getAllUpcomingEventsFromPayload } from '@/lib/utils/payload-api'
import { buildEventIcs } from '@/lib/utils/event-ics'
import { formatAddress } from '@/lib/utils/formatters'

export const revalidate = 300

function fileName(title: string): string {
  return (title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event') + '.ics'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const events = await getAllUpcomingEventsFromPayload(100)
  const event = events.find((doc) => String(doc.id) === id)
  if (!event) return new Response('Event not found', { status: 404 })

  const location = typeof event.location === 'object' ? event.location : null
  const ics = buildEventIcs({
    id: String(event.id),
    organizer: event.organizer,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    site: event.site,
    locationSlug: location?.slug ?? undefined,
    locationName: location?.name,
    address: location?.address
      ? formatAddress({
          address: location.address.street,
          city: location.address.city,
          state: location.address.state,
          zip: location.address.zip,
        })
      : undefined,
  })

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName(event.organizer)}"`,
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}
