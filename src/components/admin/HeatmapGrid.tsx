'use client'
/**
 * Client grid for the ScheduleHeatmap widget. Receives booking rows from the
 * server and renders only the visible 16-month window, with Payload's Select
 * (location filter) and ghost Buttons (‹ › paging; the range label returns to
 * today). Cell color is booking status: red nothing, orange event without
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

type Day = { events: string[]; food: string[] }
const EMPTY: Day = { events: [], food: [] }

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
  listURLs: Record<ScheduleRow['kind'], string>
}) {
  const [page, setPage] = useState(PAGES_BACK)
  const [location, setLocation] = useState('')

  const byDay = useMemo(() => {
    const map = new Map<string, Day>()
    for (const r of rows) {
      if (location && r.location !== location) continue
      const day = map.get(r.day) ?? { events: [], food: [] }
      ;(r.kind === 'event' ? day.events : day.food).push(r.name || 'Untitled')
      map.set(r.day, day)
    }
    return map
  }, [rows, location])

  const weeks = buildHeatmapWeeks(addDays(firstSunday, page * WEEKS * 7), WEEKS)
  const from = weeks[0][0]
  const through = weeks[WEEKS - 1][6]
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
            {weeks.map((week) => {
              const date = week[d]
              const { events, food } = byDay.get(date) ?? EMPTY
              const kind: DayKind =
                events.length && food.length
                  ? 'both'
                  : events.length
                    ? 'event'
                    : food.length
                      ? 'food'
                      : 'none'
              const parts = [
                events.length &&
                  `${events.length} ${plural(events.length, 'event', 'events')} (${events.join(', ')})`,
                food.length && `${food.length} food (${food.join(', ')})`,
              ].filter(Boolean)
              const label = `${date}: ${parts.length ? parts.join(', ') : 'nothing scheduled'}`
              const list = events.length || !food.length ? listURLs.event : listURLs.food
              const href = `${list}?${new URLSearchParams({
                'where[date][greater_than_equal]': getESTMidnightISO(date),
                'where[date][less_than]': getESTMidnightISO(addDays(date, 1)),
              })}`
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
