/**
 * ScheduleList's day heading. A client component so "Today"/"Tomorrow" and
 * the today highlight follow the viewer's clock after mount; server HTML (and
 * a page cached past midnight) shows the full date instead.
 */
'use client'

import { formatDate } from '@/lib/utils/formatters'
import { useTodayEST } from '@/lib/hooks/use-today-est'

/** The YYYY-MM-DD date `days` after `ymd`. */
function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

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
  const label = isToday
    ? 'Today'
    : today && dateKey === addDays(today, 1)
      ? 'Tomorrow'
      : formatDate(dateKey, 'full')

  return (
    <Heading className={`text-lg font-semibold tracking-tight mb-3 ${isToday ? 'text-primary' : ''}`}>
      {label}
    </Heading>
  )
}
