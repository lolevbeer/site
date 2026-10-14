import { NextRequest, NextResponse } from 'next/server'
import {
  getEventsForLocationFresh,
  transformPayloadEventToBreweryEvent,
} from '@/lib/utils/payload-api'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store' }

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ location: string }> },
) {
  const { location } = await params
  const data = await getEventsForLocationFresh(location.toLowerCase())
  if (!data) return NextResponse.json({ error: 'Location not found' }, { status: 404, headers })
  return NextResponse.json(
    {
      events: data.events.map((event) =>
        transformPayloadEventToBreweryEvent(
          event,
          data.location.slug ?? undefined,
          data.location.name,
        ),
      ),
      locationName: data.location.name,
      timestamp: data.events.reduce(
        (latest, event) => Math.max(latest, Date.parse(event.updatedAt) || 0),
        0,
      ),
      deployId: process.env.NEXT_PUBLIC_DEPLOY_ID || '',
    },
    { headers },
  )
}
