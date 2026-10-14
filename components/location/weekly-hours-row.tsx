/**
 * One row of WeeklyHoursTable. A client component so "today" is the viewer's
 * day after mount rather than the day the cached page was rendered.
 */
'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { useTodayEST } from '@/lib/hooks/use-today-est'
import { WEEKDAYS_FROM_SUNDAY } from '@/lib/types/location'
import type { DayOfWeek } from '@/lib/utils/payload-api'

/** A YYYY-MM-DD date as its `WeeklyHoursDay['day']` key. */
function dayOfWeek(ymd: string): DayOfWeek {
  const [year, month, day] = ymd.split('-').map(Number)
  return WEEKDAYS_FROM_SUNDAY[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
}

export function WeeklyHoursRow({
  day,
  isClosedHoliday,
  children,
}: {
  day: DayOfWeek
  isClosedHoliday: boolean
  children: React.ReactNode
}) {
  const today = useTodayEST()
  const isToday = today !== null && day === dayOfWeek(today)
  return (
    <tr
      className={cn(
        isToday && 'font-semibold text-primary',
        isClosedHoliday && !isToday && 'text-highlight',
      )}
    >
      {children}
    </tr>
  )
}
