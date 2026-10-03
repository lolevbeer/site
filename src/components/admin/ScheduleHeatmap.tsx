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
  dedupeSchedule,
  PAGES_AHEAD,
  PAGES_BACK,
  slotDatesInRange,
  WEEKS,
  type ScheduleRow,
} from '@/lib/utils/schedule-heatmap'
import type { RecurringEvent } from '@/src/payload-types'
import { expandRecurringEvents } from '@/src/utils/recurring-events'
import {
  getRecurringFoodState,
  recurringDays,
  recurringOccurrences,
} from '@/src/utils/recurring-food'
import { relationshipId } from '@/src/utils/relationship-id'

import { HeatmapGrid } from './HeatmapGrid'
import './ScheduleHeatmap.scss'

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
  const years = Array.from(
    { length: Number(lastDay.slice(0, 4)) - Number(firstSunday.slice(0, 4)) + 1 },
    (_, i) => Number(firstSunday.slice(0, 4)) + i,
  )

  // Five 16-month windows is still only a few thousand rows; no pagination.
  const [events, recurringEvents, food, foodStates, locations] = await Promise.all([
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
          select: { date: true, vendor: true, vendorName: true, location: true },
          overrideAccess: false,
          req,
        })
      : none,
    // Same per-year reader the public site and the recurring food grid use, so
    // the legacy global fallback and year scoping match everywhere.
    canFood
      ? Promise.all(
          years.map((year) =>
            getRecurringFoodState(payload, { overrideAccess: false, user: req.user, year }),
          ),
        )
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
      recurring: true,
    })),
  ]

  // Recurring slots hold vendor ids; one lookup names them. A vendor that no
  // longer resolves is skipped, as on the public site.
  const slotVendorIds = new Set<string>()
  for (const state of foodStates ?? []) {
    for (const days of Object.values(state.schedules)) {
      for (const weeks of Object.values(days)) {
        for (const id of Object.values(weeks)) if (id) slotVendorIds.add(id)
      }
    }
  }
  const vendorNames = new Map<string, string>()
  if (slotVendorIds.size) {
    const { docs } = await payload.find({
      collection: 'food-vendors',
      where: { id: { in: [...slotVendorIds] } },
      depth: 0,
      pagination: false,
      select: { name: true },
      overrideAccess: false,
      req,
    })
    for (const v of docs) vendorNames.set(v.id, v.name)
  }

  const foodRows: ScheduleRow[] = (food?.docs ?? []).map((d) => ({
    day: getDateEST(new Date(d.date)),
    kind: 'food',
    name: d.vendorName ?? '',
    location: relationshipId(d.location),
    vendor: d.vendor ? relationshipId(d.vendor) : undefined,
  }))
  for (const state of foodStates ?? []) {
    for (const [location, days] of Object.entries(state.schedules)) {
      const excluded = new Set(state.exclusions[location] ?? [])
      for (const [day, weeks] of Object.entries(days)) {
        for (const [week, vendorId] of Object.entries(weeks)) {
          const name = vendorId && vendorNames.get(vendorId)
          if (!name) continue
          const dates = slotDatesInRange(
            recurringDays.indexOf(day as (typeof recurringDays)[number]),
            recurringOccurrences.indexOf(week as (typeof recurringOccurrences)[number]) + 1,
            state.year,
            firstSunday,
            lastDay,
          )
          for (const date of dates) {
            if (excluded.has(date)) continue
            foodRows.push({
              day: date,
              kind: 'food',
              name,
              location,
              vendor: vendorId,
              recurring: true,
            })
          }
        }
      }
    }
  }

  const adminRoute = payload.config.routes.admin
  return (
    <HeatmapGrid
      rows={dedupeSchedule([...eventRows, ...foodRows])}
      locations={(locations?.docs ?? []).map((l) => ({ id: l.id, name: l.name }))}
      firstSunday={firstSunday}
      today={today}
      canEvents={canEvents}
      canFood={canFood}
      listURLs={{
        event: formatAdminURL({ adminRoute, path: '/collections/events' }),
        food: formatAdminURL({ adminRoute, path: '/collections/food' }),
        recurringEvent: formatAdminURL({ adminRoute, path: '/collections/recurring-events' }),
        recurringFood: formatAdminURL({ adminRoute, path: '/globals/recurring-food' }),
      }}
    />
  )
}
