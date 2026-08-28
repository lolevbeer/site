'use client'

/**
 * Shared weekly-hours rendering for the location surfaces.
 *
 * The footer column (components/layout/footer.tsx) and the home-page location
 * cards (components/location/location-cards.tsx) each carried their own copy of
 * this table. The DOM structure and the logic were identical and only three
 * cosmetic details differed — banner alignment and wording, the gap beside the
 * day name, and the holiday badge size — so they are merged here behind one
 * `variant` prop instead of two near-identical components that drift apart.
 *
 * The hours panel (components/location/hours-panel.tsx) is a genuinely
 * different layout: an accordion with abbreviated day names, holidays inline in
 * parentheses rather than in a badge, and its own colour scheme. Folding it in
 * would take more flags than it would save, so it stays separate and shares
 * only the two helpers below.
 */

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatHoursTime, getDayName } from '@/lib/utils/formatters'
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
 * Today as a `WeeklyHoursDay['day']` key, for highlighting the current day in
 * an hours list. Shared because every hours surface needs the same
 * `Date#getDay()` -> day-key lookup.
 */
export function getTodayDayOfWeek(): DayOfWeek {
  return DAY_KEYS[new Date().getDay()]
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
 * Per-caller cosmetics. Everything else about the table — structure, today
 * highlighting, holiday handling, closed/open wording — is shared.
 */
const VARIANT_STYLES = {
  /** Footer column: left-aligned banner, tight day gap, extra-small badge. */
  footer: {
    banner: 'flex items-center gap-1.5 mb-2 pb-2 border-b border-border',
    bannerText: 'Special hours this week',
    dayGap: 'gap-1',
    badge: 'text-[10px] py-0 px-1 border-amber-500 text-amber-600 dark:text-amber-400',
  },
  /** Location card: centred banner with a warning glyph, roomier badge. */
  card: {
    banner: 'flex items-center justify-center gap-1.5 mb-2 pb-2 border-b border-border',
    bannerText: '⚠ Special hours this week',
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
  const hasSpecialHours = weeklyHours.some((d) => d.holidayName)

  return (
    <div className="space-y-1 text-sm">
      {hasSpecialHours && (
        <div className={styles.banner}>
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            {styles.bannerText}
          </span>
        </div>
      )}
      {weeklyHours.map((dayData) => {
        const isToday = dayData.day === today
        const isSpecial = !!dayData.holidayName

        return (
          <div
            key={dayData.day}
            className={cn(
              'flex justify-between items-center gap-2',
              isToday && 'font-semibold text-primary',
              isSpecial && !isToday && 'text-amber-600 dark:text-amber-400',
            )}
          >
            <span className={cn('flex items-center', styles.dayGap)}>
              {getDayName(dayData.day)}
              {dayData.holidayName && (
                <Badge variant="outline" className={styles.badge}>
                  {dayData.holidayName}
                </Badge>
              )}
            </span>
            <span>{formatHoursRange(dayData)}</span>
          </div>
        )
      })}
    </div>
  )
}
