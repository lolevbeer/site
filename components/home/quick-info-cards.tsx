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

/** Integrated hero visit actions: menus lead, with directions beside hours and quieter schedules. */
export function QuickInfoCards({
  beerCount,
  cansCount,
  weeklyHours,
  className,
}: QuickInfoCardsProps) {
  const { locations, currentLocation, isClient } = useLocationContext()
  const summaryClass = cn('w-full max-w-xl min-h-64 text-foreground', className)
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
      <h2 className="text-xl font-bold text-balance">{location.name}</h2>
      <div className="flex flex-wrap items-center justify-center gap-x-4">
        <p className="text-sm">
          Today: {today ? formatHoursRange(today) : 'Hours not available'}
          {today?.holidayName ? ` · ${today.holidayName}` : ''}
        </p>
        {directionsUrl !== '#' ? (
          <Button asChild variant="link" size="lg" className="px-2 underline">
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
      </div>
      {today?.note ? <p className="mt-1 text-sm">{today.note}</p> : null}
      <nav aria-label={`${location.name} visit shortcuts`} className="mt-4">
        <div className="grid grid-cols-2 gap-3">
          <Button
            asChild
            size="lg"
            className="min-h-24 flex-col gap-1 px-3 sm:flex-row sm:justify-between sm:px-5"
          >
            <Link
              href={`/?${locationQuery}#draft`}
              aria-label={`On tap${draftCount === undefined ? '' : ` (${draftCount})`}`}
            >
              <span>On tap</span>
              {draftCount === undefined ? null : (
                <span className="text-2xl font-bold tabular-nums">{draftCount}</span>
              )}
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="min-h-24 flex-col gap-1 border-foreground/20 bg-background/60 px-3 sm:flex-row sm:justify-between sm:px-5"
          >
            <Link
              href={`/?${locationQuery}#cans`}
              aria-label={`Cans to go${canCount === undefined ? '' : ` (${canCount})`}`}
            >
              <span>Cans to go</span>
              {canCount === undefined ? null : (
                <span className="text-2xl font-bold tabular-nums">{canCount}</span>
              )}
            </Link>
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Button asChild variant="link" size="lg" className="px-2">
            <Link href={`/food?${locationQuery}`}>Food schedule</Link>
          </Button>
          <Button asChild variant="link" size="lg" className="px-2">
            <Link href={`/events?${locationQuery}`}>Events</Link>
          </Button>
        </div>
      </nav>
    </section>
  )
}
