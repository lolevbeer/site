/**
 * Admin dashboard widget: GitHub-style heatmap of event and food-truck
 * bookings per EST day. This server component only gathers rows (one-offs plus
 * recurring rules expanded within the year each was set up for) under the
 * viewer's read access (overrideAccess: false + req); HeatmapGrid renders the
 * visible 16-month window, paging and location filtering client-side.
 */
import type { WidgetServerProps } from 'payload'
import { formatAdminURL } from 'payload/shared'

import { getDateEST, getESTMidnightISO, getTodayEST } from '@/lib/utils/date'
import {
  addDays,
  dayOfWeek,
  PAGES_AHEAD,
  PAGES_BACK,
  slotDatesInRange,
  WEEKS,
  type ScheduleRow,
} from '@/lib/utils/schedule-heatmap'
import type { RecurringEvent } from '@/src/payload-types'
import { expandRecurringEvents } from '@/src/utils/recurring-events'
import {
  LEGACY_SCHEDULE_YEAR,
  recurringDays,
  recurringOccurrences,
} from '@/src/utils/recurring-food'
import { relationshipId } from '@/src/utils/relationship-id'

import { HeatmapGrid } from './HeatmapGrid'
import './ScheduleHeatmap.scss'

/**
 * One row per kind + location + EST day + name. A one-off can confirm a
 * recurring slot, so the same booking can arrive twice; the first wins, and
 * one-offs are listed first.
 */
function dedupe(rows: ScheduleRow[]): ScheduleRow[] {
  const seen = new Set<string>()
  return rows.filter((r) => {
    const key = `${r.kind}|${r.location}|${r.day}|${r.name.trim().toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function ScheduleHeatmap({ req, permissions }: WidgetServerProps) {
  const canEvents = Boolean(permissions?.collections?.events?.read)
  const canFood = Boolean(permissions?.collections?.food?.read)
  if (!canEvents && !canFood) return null

  const { payload } = req
  const today = getTodayEST()
  const firstSunday = addDays(today, -dayOfWeek(today) - PAGES_BACK * WEEKS * 7)
  const lastDay = addDays(firstSunday, (PAGES_BACK + 1 + PAGES_AHEAD) * WEEKS * 7 - 1)
  const where = {
    and: [
      { date: { greater_than_equal: getESTMidnightISO(firstSunday) } },
      { date: { less_than: getESTMidnightISO(addDays(lastDay, 1)) } },
    ],
  }
  const none = Promise.resolve(null)

  // Five 16-month windows is still only a few thousand rows; no pagination.
  const [events, recurringEvents, food, foodSlots, foodExclusions, locations] = await Promise.all([
    canEvents
      ? payload.find({
          collection: 'events',
          where,
          depth: 0,
          pagination: false,
          select: { date: true, organizer: true, location: true },
          overrideAccess: false,
          req,
        })
      : none,
    canEvents
      ? payload.find({
          collection: 'recurring-events',
          where: { active: { equals: true } },
          depth: 0,
          pagination: false,
          overrideAccess: false,
          req,
        })
      : none,
    canFood
      ? payload.find({
          collection: 'food',
          where,
          depth: 0,
          pagination: false,
          select: { date: true, vendorName: true, location: true },
          overrideAccess: false,
          req,
        })
      : none,
    canFood
      ? payload.find({
          collection: 'recurring-food-schedules',
          where: { active: { equals: true } },
          depth: 1,
          populate: { 'food-vendors': { name: true } },
          pagination: false,
          select: { vendor: true, year: true, day: true, occurrence: true, location: true },
          overrideAccess: false,
          req,
        })
      : none,
    canFood
      ? payload.find({
          collection: 'recurring-food-exclusions',
          where,
          depth: 0,
          pagination: false,
          select: { date: true, location: true },
          overrideAccess: false,
          req,
        })
      : none,
    payload.find({
      collection: 'locations',
      depth: 0,
      pagination: false,
      select: { name: true },
      sort: 'name',
      overrideAccess: false,
      req,
    }),
  ])

  const eventRows: ScheduleRow[] = [
    ...(events?.docs ?? []).map((d) => ({
      day: getDateEST(new Date(d.date)),
      kind: 'event' as const,
      name: d.organizer,
      location: relationshipId(d.location),
    })),
    // expandRecurringEvents keeps each rule inside its own year.
    ...expandRecurringEvents(
      (recurringEvents?.docs ?? []) as RecurringEvent[],
      firstSunday,
      lastDay,
    ).map((e) => ({
      day: e.date.slice(0, 10),
      kind: 'event' as const,
      name: e.organizer,
      location: relationshipId(e.location),
    })),
  ]

  const excluded = new Set(
    (foodExclusions?.docs ?? []).map(
      (x) => `${relationshipId(x.location)}|${getDateEST(new Date(x.date))}`,
    ),
  )
  const foodRows: ScheduleRow[] = (food?.docs ?? []).map((d) => ({
    day: getDateEST(new Date(d.date)),
    kind: 'food',
    name: d.vendorName ?? '',
    location: relationshipId(d.location),
  }))
  for (const slot of foodSlots?.docs ?? []) {
    const location = relationshipId(slot.location)
    const days = slotDatesInRange(
      recurringDays.indexOf(slot.day),
      recurringOccurrences.indexOf(slot.occurrence) + 1,
      slot.year ?? LEGACY_SCHEDULE_YEAR,
      firstSunday,
      lastDay,
    )
    for (const day of days) {
      if (excluded.has(`${location}|${day}`)) continue
      foodRows.push({
        day,
        kind: 'food',
        name: typeof slot.vendor === 'object' ? slot.vendor.name : '',
        location,
      })
    }
  }

  const adminRoute = payload.config.routes.admin
  return (
    <HeatmapGrid
      rows={dedupe([...eventRows, ...foodRows])}
      locations={(locations?.docs ?? []).map((l) => ({ id: l.id, name: l.name }))}
      firstSunday={firstSunday}
      today={today}
      canEvents={canEvents}
      canFood={canFood}
      listURLs={{
        event: formatAdminURL({ adminRoute, path: '/collections/events' }),
        food: formatAdminURL({ adminRoute, path: '/collections/food' }),
      }}
    />
  )
}
