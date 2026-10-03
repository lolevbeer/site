'use client'
/**
 * Client grid for the ScheduleHeatmap widget. Receives booking rows from the
 * server and renders only the visible 16-month window, with Payload's Select
 * (location filter) and ghost Buttons (‹ › paging; the range label returns to
 * today). Each day links to its filtered list, or to the recurring rules when
 * only rules book it. Cell color is booking status: red nothing, orange event without
 * food, yellow food only, green both.
 */
import { Button, ChevronIcon, Select } from '@payloadcms/ui'
import { useMemo, useState, type CSSProperties } from 'react'

import { getESTMidnightISO } from '@/lib/utils/date'
import {
  addDays,
  buildHeatmapWeeks,
  monthName,
  monthSpans,
  PAGES_AHEAD,
  PAGES_BACK,
  WEEKS,
  type DayKind,
  type ScheduleRow,
} from '@/lib/utils/schedule-heatmap'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const LEGEND: { kind: DayKind; label: string }[] = [
  { kind: 'none', label: 'Nothing booked' },
  { kind: 'event', label: 'Event, no food' },
  { kind: 'food', label: 'Food only' },
  { kind: 'both', label: 'Both' },
]
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/** Names booked on one day, and whether any came from a stored document. */
type Day = { events: string[]; food: string[]; eventDoc: boolean; foodDoc: boolean }
type Cell = { date: string; kind: DayKind; label: string; href: string }

/** Cell color from what the day has booked. */
function dayKind(d: Day | undefined): DayKind {
  if (!d) return 'none'
  if (d.events.length && d.food.length) return 'both'
  return d.events.length ? 'event' : d.food.length ? 'food' : 'none'
}

/** Hover text, e.g. "2026-10-10: 2 events (A, B), 1 food (C)". */
function dayLabel(date: string, d: Day | undefined): string {
  const parts = [
    d?.events.length &&
      `${d.events.length} ${plural(d.events.length, 'event', 'events')} (${d.events.join(', ')})`,
    d?.food.length && `${d.food.length} food (${d.food.join(', ')})`,
  ].filter(Boolean)
  return `${date}: ${parts.length ? parts.join(', ') : 'nothing scheduled'}`
}

export function HeatmapGrid({
  rows,
  locations,
  firstSunday,
  today,
  canEvents,
  canFood,
  listURLs,
}: {
  rows: ScheduleRow[]
  locations: { id: string; name: string }[]
  firstSunday: string
  today: string
  canEvents: boolean
  canFood: boolean
  /** Day lists for stored docs; `recurring*` for days booked only by a rule. */
  listURLs: { event: string; food: string; recurringEvent: string; recurringFood: string }
}) {
  const [page, setPage] = useState(PAGES_BACK)
  const [location, setLocation] = useState('')

  const byDay = useMemo(() => {
    const map = new Map<string, Day>()
    for (const r of rows) {
      if (location && r.location !== location) continue
      const day = map.get(r.day) ?? { events: [], food: [], eventDoc: false, foodDoc: false }
      if (r.kind === 'event') {
        day.events.push(r.name || 'Untitled')
        day.eventDoc ||= !r.recurring
      } else {
        day.food.push(r.name || 'Untitled')
        day.foodDoc ||= !r.recurring
      }
      map.set(r.day, day)
    }
    return map
  }, [rows, location])

  const weeks = useMemo(
    () => buildHeatmapWeeks(addDays(firstSunday, page * WEEKS * 7), WEEKS),
    [firstSunday, page],
  )
  const from = weeks[0][0]
  const through = weeks[WEEKS - 1][6]

  // Computed once per page/location: ~490 cells, two EST conversions each.
  const cells = useMemo(
    () =>
      weeks.map((week) =>
        week.map((date): Cell => {
          const d = byDay.get(date)
          // Event list when the day has events (or nothing), else food. Days
          // booked only by recurring rules have no dated docs, so they open
          // the rule list instead of an empty filtered list.
          const isEvent = Boolean(d?.events.length) || !d?.food.length
          const hasDoc = isEvent ? d?.eventDoc : d?.foodDoc
          const params = new URLSearchParams({
            'where[date][greater_than_equal]': getESTMidnightISO(date),
            'where[date][less_than]': getESTMidnightISO(addDays(date, 1)),
          })
          if (location) params.set('where[location][equals]', location)
          const href =
            d && !hasDoc
              ? isEvent
                ? listURLs.recurringEvent
                : listURLs.recurringFood
              : `${isEvent ? listURLs.event : listURLs.food}?${params}`
          return { date, kind: dayKind(d), label: dayLabel(date, d), href }
        }),
      ),
    [weeks, byDay, location, listURLs],
  )
  let eventCount = 0
  let foodCount = 0
  for (const [day, d] of byDay) {
    if (day < from || day > through) continue
    eventCount += d.events.length
    foodCount += d.food.length
  }
  const totals = [
    canEvents && `${eventCount} ${plural(eventCount, 'event', 'events')}`,
    canFood && `${foodCount} food`,
  ]
    .filter(Boolean)
    .join(', ')
  const options = [
    { label: 'All locations', value: '' },
    ...locations.map((l) => ({ label: l.name, value: l.id })),
  ]

  return (
    <div className="card widget-card schedule-heatmap">
      <div className="widget-card__header schedule-heatmap__header">
        <h3 id="hm-title" className="widget-card__title">
          Schedule
        </h3>
        {locations.length > 1 && (
          <Select
            className="schedule-heatmap__location"
            aria-label="Location"
            isClearable={false}
            isSearchable={false}
            options={options}
            value={options.find((o) => o.value === location)}
            onChange={(option) => {
              if (!Array.isArray(option)) setLocation(String(option.value))
            }}
          />
        )}
        <Button
          buttonStyle="ghost"
          disabled={page === PAGES_BACK}
          tooltip={page === PAGES_BACK ? undefined : 'Back to today'}
          onClick={() => setPage(PAGES_BACK)}
        >
          {`${monthName(from)} ${from.slice(0, 4)} – ${monthName(through)} ${through.slice(0, 4)} (${totals})`}
        </Button>
        <span className="schedule-heatmap__arrows">
          <Button
            buttonStyle="ghost"
            round
            aria-label="Earlier"
            disabled={page === 0}
            icon={<ChevronIcon direction="left" />}
            onClick={() => setPage(page - 1)}
          />
          <Button
            buttonStyle="ghost"
            round
            aria-label="Later"
            disabled={page === PAGES_BACK + PAGES_AHEAD}
            icon={<ChevronIcon direction="right" />}
            onClick={() => setPage(page + 1)}
          />
        </span>
      </div>
      <div
        role="grid"
        aria-labelledby="hm-title"
        className="schedule-heatmap__grid"
        style={{ '--hm-weeks': WEEKS } as CSSProperties}
      >
        <div className="schedule-heatmap__row" aria-hidden="true">
          <span />
          {monthSpans(weeks).map(({ label, span }, i) => (
            <span
              key={`${label}-${i}`}
              className="schedule-heatmap__month"
              style={{ gridColumn: `span ${span}` }}
            >
              {span > 1 ? label : ''}
            </span>
          ))}
        </div>
        {DAY_LABELS.map((dow, d) => (
          <div role="row" key={dow} className="schedule-heatmap__row">
            <span role="rowheader" className="schedule-heatmap__dow">
              {d % 2 ? dow : ''}
            </span>
            {cells.map((week) => {
              const { date, kind, label, href } = week[d]
              return (
                <a
                  role="gridcell"
                  key={date}
                  href={href}
                  title={label}
                  data-kind={kind}
                  className={`schedule-heatmap__cell${date === today ? ' is-today' : ''}${date < today ? ' is-past' : ''}`}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="schedule-heatmap__legend" aria-hidden="true">
        {LEGEND.map(({ kind, label }) => (
          <span key={kind} className="schedule-heatmap__key">
            <span className="schedule-heatmap__swatch" data-kind={kind} /> {label}
          </span>
        ))}
      </div>
    </div>
  )
}
