/**
 * ScheduleList's day heading. A client component so "Today"/"Tomorrow" and
 * the today highlight follow the viewer's clock after mount; server HTML (and
 * a page cached past midnight) shows the full date instead.
 */
'use client'

import { formatDayLabel } from '@/lib/utils/formatters'
import { useTodayEST } from '@/lib/hooks/use-today-est'

export function ScheduleDayHeading({
  dateKey,
  level,
}: {
  /** The group's YYYY-MM-DD date. */
  dateKey: string
  level: 2 | 3
}) {
  const today = useTodayEST()
  const Heading = level === 2 ? 'h2' : 'h3'
  const isToday = dateKey === today
  return (
    <Heading className={`text-lg font-semibold tracking-tight mb-3 ${isToday ? 'text-primary' : ''}`}>
      {formatDayLabel(dateKey, today)}
    </Heading>
  )
}
