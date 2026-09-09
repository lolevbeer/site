'use client'

import React, { useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/section-header'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import { ScheduleList } from '@/components/ui/schedule-list'
import { parseLocalDate } from '@/lib/utils/formatters'
import { useLocationFilteredData, type LocationData } from '@/lib/hooks/use-location-filtered-data'
import { useLocationContext } from '@/components/location/location-provider'
import { useSortedItems } from '@/lib/hooks/use-sorted-items'
import { getLocationDisplayName } from '@/lib/config/locations'
import { safeHttpUrl } from '@/lib/utils/url-utils'
import type { Event as PayloadEvent } from '@/src/payload-types'

type EventWithLocationSlug = PayloadEvent & { locationSlug: string }

interface UpcomingEventsProps {
  /** Events organized by location slug */
  eventsByLocation: Record<string, PayloadEvent[]>
}

export function UpcomingEvents({ eventsByLocation }: UpcomingEventsProps) {
  const { currentLocation, currentLocationData, locations } = useLocationContext()

  const dataByLocation = useMemo(() => {
    const result: LocationData<EventWithLocationSlug> = {}
    for (const [slug, events] of Object.entries(eventsByLocation)) {
      result[slug] = events.map((e) => ({ ...e, locationSlug: slug }))
    }
    return result
  }, [eventsByLocation])

  const filteredEvents = useLocationFilteredData({ dataByLocation })
  const getEventDate = useCallback((e: EventWithLocationSlug) => parseLocalDate(e.date), [])
  const upcomingEvents = useSortedItems(filteredEvents, {
    getDate: getEventDate,
    limit: 6,
  })

  if (upcomingEvents.length === 0) {
    return null
  }

  return (
    <section className="py-16 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <SectionHeader
            title="Events"
            locationName={currentLocationData?.name}
            adminUrl="/admin/collections/events"
          />
        </ScrollReveal>

        <div className="max-w-2xl mx-auto mb-8">
          <ScheduleList
            items={upcomingEvents.map((event) => ({
              id: String(event.id),
              date: event.date,
              title: event.organizer || 'Event',
              time: event.startTime,
              endTime: event.endTime,
              site: safeHttpUrl(event.site),
              locationName:
                currentLocation === 'all'
                  ? getLocationDisplayName(locations, event.locationSlug)
                  : undefined,
            }))}
          />
        </div>

        <div className="text-center">
          <Button asChild variant="outline" size="lg">
            <Link href="/events">View All</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
