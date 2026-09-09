'use client'

/**
 * Shared weekly-hours rendering for the location surfaces.
 *
 * Footer, homepage location cards, taproom landings, and the beer-map hours
 * section all use this table. Banner alignment, the gap beside the day name,
 * and holiday badge size differ behind one `variant` prop so those surfaces
 * cannot drift apart. Banner copy is shared via `specialHoursBanner`.
 */

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatHoursTime, getDayName } from '@/lib/utils/formatters'
import { getTodayEST } from '@/lib/utils/date'
import type { DayOfWeek, WeeklyHoursDay } from '@/lib/utils/payload-api'

/** Day keys indexed by `Date#getDay()` (0 = Sunday). */
const DAY_KEYS: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

/**
 * Today as a `WeeklyHoursDay['day']` key in America/New_York, so SSR (UTC)
 * and the taprooms highlight the same day.
 */
export function getTodayDayOfWeek(): DayOfWeek {
  const [year, month, day] = getTodayEST().split('-').map(Number)
  return DAY_KEYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
}

/**
 * A day's opening hours as display text: "Closed", or the formatted
 * `open - close` range. Shared so every surface words a closure identically.
 */
export function formatHoursRange(dayData: WeeklyHoursDay): string {
  if (dayData.closed) return 'Closed'
  return `${formatHoursTime(dayData.open, dayData.timezone)} - ${formatHoursTime(dayData.close, dayData.timezone)}`
}

/**
 * One-line holiday summary for the hours banner. Names the day and holiday
 * (and "Closed …" when they are) instead of a generic "special hours" warning.
 * A CMS `note` wins when present.
 */
export function specialHoursBanner(weeklyHours: WeeklyHoursDay[]): string | null {
  const special = weeklyHours.filter((d) => d.holidayName)
  if (special.length === 0) return null

  const notes = [
    ...new Set(special.map((d) => d.note?.trim()).filter((note): note is string => Boolean(note))),
  ]
  if (notes.length === 1) return notes[0]
  if (notes.length > 1) return notes.join(' · ')

  if (special.length === 1) {
    const d = special[0]
    const dayName = getDayName(d.day)
    if (d.closed) return `Closed ${dayName} for ${d.holidayName}`
    return `${d.holidayName} hours (${dayName})`
  }

  const names = [...new Set(special.map((d) => d.holidayName))]
  const allClosed = special.every((d) => d.closed)
  if (allClosed && names.length === 1) {
    const days = special.map((d) => getDayName(d.day)).join(' & ')
    return `Closed ${days} for ${names[0]}`
  }
  if (names.length === 1) return `${names[0]} hours this week`
  return 'Holiday hours this week'
}

/**
 * Per-caller cosmetics. Everything else about the table — structure, today
 * highlighting, holiday handling, closed/open wording — is shared.
 */
const VARIANT_STYLES = {
  /** Footer column: tight day gap, extra-small badge. */
  footer: {
    banner: 'flex items-center justify-center gap-1.5 mb-2 text-center',
    dayGap: 'gap-1',
    badge: 'text-[10px] py-0 px-1 border-amber-500 text-amber-600 dark:text-amber-400',
  },
  /** Location card: roomier badge. */
  card: {
    banner: 'flex items-center justify-center gap-1.5 mb-2 text-center',
    dayGap: 'gap-2',
    badge: 'text-xs py-0 px-1.5 border-amber-500 text-amber-600 dark:text-amber-400',
  },
} as const

export interface WeeklyHoursTableProps {
  weeklyHours: WeeklyHoursDay[]
  /** `'footer'` for the footer column, `'card'` for the location cards. */
  variant: keyof typeof VARIANT_STYLES
}

/**
 * A week of opening hours as a day/time list, with today emphasised and any
 * holiday override called out.
 */
export function WeeklyHoursTable({ weeklyHours, variant }: WeeklyHoursTableProps) {
  const styles = VARIANT_STYLES[variant]
  const today = getTodayDayOfWeek()
  const banner = specialHoursBanner(weeklyHours)

  return (
    <div className="space-y-1 text-sm text-center">
      {banner ? (
        <div className={styles.banner}>
          <span className="text-xs font-medium text-pretty text-amber-600 dark:text-amber-400">
            {banner}
          </span>
        </div>
      ) : null}
      <div className="gradient-separator mb-2" />
      <table className="mx-auto">
        <caption className="sr-only">Weekly hours</caption>
        <tbody>
          {weeklyHours.map((dayData) => {
            const isToday = dayData.day === today
            const isClosedHoliday = Boolean(dayData.holidayName && dayData.closed)

            return (
              <tr
                key={dayData.day}
                className={cn(
                  isToday && 'font-semibold text-primary',
                  isClosedHoliday && !isToday && 'text-amber-600 dark:text-amber-400',
                )}
              >
                <th
                  scope="row"
                  className={cn('font-normal text-left pr-2 py-0.5', styles.dayGap, 'flex items-center')}
                >
                  {getDayName(dayData.day)}
                  {dayData.holidayName ? (
                    <Badge variant="outline" className={styles.badge}>
                      {dayData.holidayName}
                    </Badge>
                  ) : null}
                </th>
                <td className="tabular-nums text-left py-0.5">{formatHoursRange(dayData)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
