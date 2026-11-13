'use client'

import React, { useMemo, useState } from 'react'
import type { FoodPageSchedule } from '@/lib/utils/public-client-payloads'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { UtensilsCrossed } from '@/components/icons'
import { useLocationContext } from '@/components/location/location-provider'
import { getLocationDisplayName } from '@/lib/config/locations'
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs'
import { HubIntro } from '@/components/ui/hub-intro'
import { FoodSchedule, type FoodScheduleItem } from '@/components/food/food-schedule'
import { TimelineItem } from '@/components/ui/timeline-item'
import { addEstDays, isTodayOrFuture } from '@/lib/utils/formatters'
import { OUTSIDE_FOOD_POLICY } from '@/lib/utils/faq-schema'
import { safeHttpUrl } from '@/lib/utils/url-utils'
import { useTodayEST } from '@/lib/hooks/use-today-est'

/** Days listed before "Show later dates", today included. */
const LISTED_DAYS = 7

interface FoodPageClientProps {
  /** CMS intro paragraph shown under the heading. */
  intro?: string
  /** Schedules trimmed to rendered fields (see toFoodPageSchedules). */
  initialSchedules: FoodPageSchedule[]
}

function dayOf(schedule: FoodPageSchedule): string {
  return schedule.date.split('T')[0]
}

function toItem(schedule: FoodPageSchedule, index: number): FoodScheduleItem {
  return {
    id: `${schedule.vendor}-${schedule.date}-${index}`,
    date: schedule.date,
    vendor: schedule.vendor,
    time: schedule.time,
    site: safeHttpUrl(schedule.site),
    logoUrl: schedule.logoUrl,
  }
}

/**
 * /food leads with today at the selected taproom (#338): the booked truck, or
 * the FAQ's outside-food policy, so an empty day never reads as "no food".
 * Then the coming week, with later dates behind a button.
 */
export function FoodPageClient({ initialSchedules, intro }: FoodPageClientProps) {
  const { currentLocation, locations, cycleLocation } = useLocationContext()
  // The server list is already upcoming-only. Past days are dropped, and the
  // Today card appears, only once mounted, so HTML cached before midnight
  // hydrates without a mismatch.
  const today = useTodayEST()
  const [showLater, setShowLater] = useState(false)

  const filteredSchedules = useMemo(() => {
    return initialSchedules
      .filter(
        (schedule) =>
          schedule.location === currentLocation &&
          (today === null || isTodayOrFuture(schedule.date, today)),
      )
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [initialSchedules, currentLocation, today])

  const { todaySchedules, thisWeek, later } = useMemo(() => {
    const rest = filteredSchedules.filter((s) => dayOf(s) !== today)
    // Before mount, the week counts from the first listed day.
    const start = today ?? (filteredSchedules[0] ? dayOf(filteredSchedules[0]) : null)
    const end = start ? addEstDays(start, LISTED_DAYS) : ''
    return {
      todaySchedules: filteredSchedules.filter((s) => dayOf(s) === today),
      thisWeek: rest.filter((s) => dayOf(s) < end),
      later: rest.filter((s) => dayOf(s) >= end),
    }
  }, [filteredSchedules, today])

  const otherLocationsWithFood = useMemo(() => {
    const otherLocations = locations.filter((loc) => {
      const slug = loc.slug || loc.id
      return slug !== currentLocation && loc.active !== false
    })
    return otherLocations.filter((loc) => {
      const slug = loc.slug || loc.id
      return initialSchedules.some(
        (s) => s.location === slug && (today === null || isTodayOrFuture(s.date, today)),
      )
    })
  }, [initialSchedules, currentLocation, locations, today])

  const locationName = getLocationDisplayName(locations, currentLocation)
  const listed = showLater ? [...thisWeek, ...later] : thisWeek

  return (
    <div className="container mx-auto px-4 py-8">
      <PageBreadcrumbs className="mb-6" />
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Food</h1>
        <HubIntro text={intro} />
      </div>

      <div className="max-w-2xl mx-auto">
        {filteredSchedules.length > 0 ? (
          <>
            {today !== null ? (
              <section className="rounded-xl border border-border px-4 py-5 mb-10 text-center">
                <h2 className="text-lg font-semibold tracking-tight mb-2">
                  Today at {locationName}
                </h2>
                {todaySchedules.length > 0 ? (
                  <ul className="list-none p-0 m-0 space-y-3">
                    {todaySchedules.map(toItem).map((item) => (
                      <li key={item.id}>
                        <TimelineItem
                          title={item.vendor}
                          time={item.time || undefined}
                          site={item.site}
                          imageUrl={item.logoUrl}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <>
                    <p>No food truck today</p>
                    <p className="text-sm text-muted-foreground text-balance mt-1">
                      {OUTSIDE_FOOD_POLICY}
                    </p>
                  </>
                )}
              </section>
            ) : null}

            <h2 className="sr-only">Upcoming food</h2>
            {listed.length > 0 ? <FoodSchedule items={listed.map(toItem)} /> : null}
            {later.length > 0 && !showLater ? (
              <div className="text-center mt-8">
                <Button variant="outline" onClick={() => setShowLater(true)}>
                  Show later dates
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UtensilsCrossed className="h-6 w-6" />
              </EmptyMedia>
              <EmptyTitle>No Food Trucks Scheduled</EmptyTitle>
              <EmptyDescription>
                No upcoming food trucks at {locationName}. {OUTSIDE_FOOD_POLICY}
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
