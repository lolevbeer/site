'use client'

import React, { useMemo } from 'react'
import type { FoodClientItem } from '@/lib/utils/public-client-payloads'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { UtensilsCrossed } from '@/components/icons'
import { useLocationContext } from '@/components/location/location-provider'
import { getLocationDisplayName } from '@/lib/config/locations'
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs'
import { HubIntro } from '@/components/ui/hub-intro'
import { FoodSchedule } from '@/components/food/food-schedule'
import { isTodayOrFuture } from '@/lib/utils/formatters'
import { safeHttpUrl } from '@/lib/utils/url-utils'

interface FoodPageClientProps {
  /** CMS intro paragraph shown under the heading. */
  intro?: string
  /** Schedules projected by the server page to just the displayed fields. */
  initialSchedules: FoodClientItem[]
}

export function FoodPageClient({ initialSchedules, intro }: FoodPageClientProps) {
  // Use the same selected location as the header and schedule filter.
  const { currentLocation, currentLocationData, isClient, locations, cycleLocation } =
    useLocationContext()

  const filteredSchedules = useMemo(() => {
    return initialSchedules
      .filter((schedule) => schedule.location === currentLocation && isTodayOrFuture(schedule.date))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [initialSchedules, currentLocation])

  const otherLocationsWithFood = useMemo(() => {
    const otherLocations = locations.filter((loc) => {
      const slug = loc.slug || loc.id
      return slug !== currentLocation && loc.active !== false
    })
    return otherLocations.filter((loc) => {
      const slug = loc.slug || loc.id
      return initialSchedules.some((s) => s.location === slug && isTodayOrFuture(s.date))
    })
  }, [initialSchedules, currentLocation, locations])

  return (
    <div className="container mx-auto px-4 py-8">
      <PageBreadcrumbs className="mb-6" />
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight">
          {isClient && currentLocationData?.name ? `Food at ${currentLocationData.name}` : 'Food'}
        </h1>
        <HubIntro text={intro} />
      </div>

      <div className="max-w-2xl mx-auto">
        <h2 className="sr-only">Upcoming food</h2>
        {filteredSchedules.length > 0 ? (
          <>
            <p className="mb-4 text-center text-muted-foreground">
              Vendors and serving times for this taproom are listed below by date.
            </p>
            <FoodSchedule
              items={filteredSchedules.map((schedule, index) => ({
                id: `${schedule.vendor}-${schedule.date}-${index}`,
                date: schedule.date,
                vendor: schedule.vendor,
                time: schedule.time || schedule.start,
                site: safeHttpUrl(schedule.site),
                logoUrl: schedule.logoUrl,
              }))}
            />
          </>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UtensilsCrossed className="h-6 w-6" />
              </EmptyMedia>
              <EmptyTitle>No Food Trucks Scheduled</EmptyTitle>
              <EmptyDescription>
                No upcoming food trucks at {getLocationDisplayName(locations, currentLocation)}.
                {otherLocationsWithFood.length > 0 && (
                  <>
                    {' '}
                    <Button variant="link" className="h-auto p-0 text-base" onClick={cycleLocation}>
                      Check {otherLocationsWithFood[0].name}
                    </Button>
                  </>
                )}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>

      <div className="text-center space-y-3 pt-12 mt-12">
        <h2 className="text-lg font-semibold">Food Truck Partner?</h2>
        <div className="flex justify-center gap-4 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <a href="mailto:events@lolev.beer">events@lolev.beer</a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="tel:4123368965">(412) 336-8965</a>
          </Button>
        </div>
      </div>
    </div>
  )
}
