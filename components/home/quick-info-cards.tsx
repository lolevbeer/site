'use client'

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLocationContext } from '@/components/location/location-provider'
import { getLocationDirectionsUrl } from '@/lib/config/locations'
import { formatHoursRange } from '@/components/location/weekly-hours'
import { getTodayEST } from '@/lib/utils/date'
import { trackDirections } from '@/lib/analytics/events'
import type { WeeklyHoursDay } from '@/lib/utils/payload-api'

interface QuickInfoCardsProps {
  /** Draft tap count by location slug. Missing counts leave the shortcut unnumbered. */
  beerCount?: Record<string, number>
  /** Cans count by location slug. */
  cansCount?: Record<string, number>
  /** Server-supplied current week, including holiday overrides; never regular context hours. */
  weeklyHours?: Record<string, WeeklyHoursDay[]>
  className?: string
}

/** Compact selected-taproom visit summary, placed before the hero carousel and brand story. */
export function QuickInfoCards({
  beerCount,
  cansCount,
  weeklyHours,
  className,
}: QuickInfoCardsProps) {
  const { locations, currentLocation, isClient } = useLocationContext()
  const summaryClass = cn(
    'w-full max-w-3xl min-h-44 md:min-h-28 rounded-xl border border-border bg-background/90 p-4 md:p-5',
    className,
  )
  // ISR cannot know the stored taproom; reserve the summary until the provider restores it.
  if (!isClient) {
    return (
      <section aria-label="Plan your visit" className={summaryClass}>
        <p className="text-sm">Choose a taproom above to plan your visit</p>
      </section>
    )
  }
  const location = locations.find((item) => (item.slug || item.id) === currentLocation)
  if (!location) return null

  const slug = location.slug || location.id
  // These are source calendar dates, not instants to shift into the previous EDT day.
  // A weekday-only match can pick next Sunday's holiday when UTC has reached Monday.
  const todayDate = getTodayEST()
  const today = weeklyHours?.[slug]?.find(
    (day) => new Date(day.date).toISOString().slice(0, 10) === todayDate,
  )
  const directionsUrl = getLocationDirectionsUrl(location)
  const draftCount = beerCount?.[slug]
  const canCount = cansCount?.[slug]
  const locationQuery = `loc=${encodeURIComponent(slug)}`

  return (
    <section aria-label="Plan your visit" className={summaryClass}>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <h2 className="text-lg font-bold">{location.name}</h2>
        <p className="text-sm">
          Today: {today ? formatHoursRange(today) : 'Hours not available'}
          {today?.holidayName ? ` · ${today.holidayName}` : ''}
        </p>
      </div>
      {today?.note ? <p className="mt-1 text-sm text-muted-foreground">{today.note}</p> : null}
      <nav
        aria-label={`${location.name} visit shortcuts`}
        className="mt-3 flex flex-wrap justify-center gap-2"
      >
        {directionsUrl !== '#' ? (
          <Button asChild variant="outline">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackDirections(location.name)}
            >
              Directions
            </a>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href={`/?${locationQuery}#draft`}>
            On Tap{draftCount === undefined ? '' : ` (${draftCount})`}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/?${locationQuery}#cans`}>
            Cans{canCount === undefined ? '' : ` (${canCount})`}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/food?${locationQuery}`}>Food</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/events?${locationQuery}`}>Events</Link>
        </Button>
      </nav>
    </section>
  )
}
