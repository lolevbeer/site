/**
 * Generated social card for one public event (one-off or recurring occurrence).
 * 404 for unknown, private, past, or malformed ids.
 */
import { getPublicEventById } from '@/lib/utils/payload-api'
import { formatDate, formatTimeRange } from '@/lib/utils/formatters'
import { ogNotFound, renderOgCard } from '@/lib/og/card'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const event = await getPublicEventById(id)
  if (!event) return ogNotFound()

  // e.g. "Fri, Nov 7 · 7pm–10pm · Lawrenceville Taproom"; missing parts are skipped.
  const locationName = typeof event.location === 'object' ? event.location?.name : undefined
  const subtitle = [
    formatDate(event.date, 'short'),
    formatTimeRange(event.startTime, event.endTime),
    locationName ? `${locationName} Taproom` : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
  return renderOgCard({ title: event.organizer, subtitle })
}
