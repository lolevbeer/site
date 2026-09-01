'use client'

import React, { useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/ui/section-header'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatTime, parseLocalDate } from '@/lib/utils/formatters'
import { useLocationFilteredData, type LocationData } from '@/lib/hooks/use-location-filtered-data'
import { useLocationContext } from '@/components/location/location-provider'
import { useSortedItems } from '@/lib/hooks/use-sorted-items'
import type { Event as PayloadEvent } from '@/src/payload-types'

type EventWithLocationSlug = PayloadEvent & { locationSlug: string }

interface UpcomingEventsProps {
  /** Events organized by location slug */
  eventsByLocation: Record<string, PayloadEvent[]>
}

export function UpcomingEvents({ eventsByLocation }: UpcomingEventsProps) {
  const { currentLocationData } = useLocationContext()

  // Create data structure for location filtering
  const dataByLocation = useMemo(() => {
    const result: LocationData<EventWithLocationSlug> = {}
    for (const [slug, events] of Object.entries(eventsByLocation)) {
      result[slug] = events.map((e) => ({ ...e, locationSlug: slug }))
    }
    return result
  }, [eventsByLocation])

  // Filter by current location
  const filteredEvents = useLocationFilteredData({ dataByLocation })

  // Date parser for events (uses parseLocalDate for proper timezone handling)
  const getEventDate = useCallback((e: EventWithLocationSlug) => parseLocalDate(e.date), [])

  // Sort and take first 3
  const upcomingEvents = useSortedItems(filteredEvents, {
    getDate: getEventDate,
    limit: 3,
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {upcomingEvents.map((event, index) => {
            const title = event.organizer || 'Event'
            const site = event.site || undefined
            const time = event.startTime || undefined
            const endTime = event.endTime || undefined
            const locationName = currentLocationData?.name || event.locationSlug

            return (
              <Card
                key={index}
                className={`overflow-hidden bg-transparent shadow-none transition-colors ${
                  site
                    ? 'cursor-pointer border border-border hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                    : ''
                }`}
                onClick={() => site && window.open(site, '_blank')}
                onKeyDown={
                  site
                    ? (keyboardEvent) => {
                        if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                          keyboardEvent.preventDefault()
                          window.open(site, '_blank')
                        }
                      }
                    : undefined
                }
                tabIndex={site ? 0 : undefined}
                role={site ? 'link' : undefined}
                aria-label={site ? `${title} - opens in new window` : undefined}
              >
                <CardContent className="p-6 text-center">
                  <h3 className="text-xl font-semibold mb-2">{title}</h3>
                  <div className="space-y-1 text-sm text-muted-foreground flex flex-col items-center">
                    <span>{formatDate(event.date, 'full')}</span>
                    {time && time.toLowerCase() !== 'tbd' && (
                      <span>
                        {formatTime(time.trim())}
                        {endTime &&
                          endTime.toLowerCase() !== 'tbd' &&
                          `–${formatTime(endTime.trim())}`}
                      </span>
                    )}
                    <span>{locationName}</span>
                    {event.attendees && <span>{event.attendees} attending</span>}
                  </div>
                </CardContent>
              </Card>
            )
          })}
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
