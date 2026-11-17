'use client'
/**
 * Client grid for the ScheduleHeatmap widget. Receives booking rows from the
 * server and renders the visible 6-month window for one location, with
 * ghost Buttons (‹ › paging; the range label returns to today), a "Tonight:"
 * line and a Pill counting open nights without food in the next four weeks.
 * Each day links to its filtered list, or to the recurring rules when only
 * rules book it.
 *
 * A cell answers two questions separately: its fill is food (green = booked,
 * gray = open with no food, hatched = closed per the location's weekly
 * hours) and a dot is an event. An event with no food turns pale red with a
 * red dot, the only alarm color. Day details show in one Payload Tooltip on
 * the hovered or focused cell (and as its aria-label).
 */
import { Button, ChevronIcon, Pill, Tooltip } from '@payloadcms/ui'
import { useMemo, useState, type CSSProperties } from 'react'

import { getESTMidnightISO } from '@/lib/utils/date'
import {
  addDays,
  buildHeatmapWeeks,
  DAY_NAMES,
  dayLabel,
  dayOfWeek,
  groupByDay,
  monthName,
  monthSpans,
  openNightsWithoutFood,
  PAGES_AHEAD,
  PAGES_BACK,
  tonightSummary,
  WEEKS,
  type ScheduleRow,
} from '@/lib/utils/schedule-heatmap'

/** What a cell or legend swatch shows; each flag becomes a data attribute the styles read. */
type Marks = { food?: boolean; event?: boolean; closed?: boolean }

const LEGEND: (Marks & { label: string })[] = [
  { label: 'Food booked', food: true },
  { label: 'No food' },
  { label: 'Closed', closed: true },
  { label: 'Event', event: true, food: true },
  { label: 'Event, no food', event: true },
]
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/** `data-*` presence attributes for the stylesheet; false flags are left off. */
const markAttrs = ({ food, event, closed }: Marks) => ({
  'data-food': food || undefined,
  'data-event': event || undefined,
  'data-closed': closed || undefined,
})

type Cell = Marks & { date: string; label: string; href: string }

export function HeatmapGrid({
  rows,
  location,
  closedDays,
  firstSunday,
  today,
  listURLs,
}: {
  /** Rows for this location only. */
  rows: ScheduleRow[]
  location: { id: string; name: string }
  /** Weekdays (0 = Sunday) the location has no opening hours. */
  closedDays: number[]
  firstSunday: string
  today: string
  /** Day lists for stored docs; `recurring*` for days booked only by a rule. */
  listURLs: { event: string; food: string; recurringEvent: string; recurringFood: string }
}) {
  const [page, setPage] = useState(PAGES_BACK)
  // Date of the hovered or focused cell; only that cell renders a Tooltip.
  const [active, setActive] = useState<string | null>(null)

  const byDay = useMemo(() => groupByDay(rows), [rows])
  const tonight = useMemo(
    () => tonightSummary(byDay, today, closedDays),
    [byDay, today, closedDays],
  )
  const gaps = useMemo(
    () => openNightsWithoutFood(byDay, today, closedDays),
    [byDay, today, closedDays],
  )

  const weeks = useMemo(
    () => buildHeatmapWeeks(addDays(firstSunday, page * WEEKS * 7), WEEKS),
    [firstSunday, page],
  )
  const from = weeks[0][0]
  const through = weeks[WEEKS - 1][6]

  // Computed once per page/location: ~180 cells, two EST conversions each.
  const cells = useMemo(
    () =>
      weeks.map((week) =>
        week.map((date): Cell => {
          const d = byDay.get(date)
          const closed = closedDays.includes(dayOfWeek(date))
          // Event list when the day has events (or nothing), else food. Days
          // booked only by recurring rules have no dated docs, so they open
          // the rule list instead of an empty filtered list.
          const isEvent = Boolean(d?.events.length) || !d?.food.length
          const hasDoc = isEvent ? d?.eventDoc : d?.foodDoc
          const params = new URLSearchParams({
            'where[date][greater_than_equal]': getESTMidnightISO(date),
            'where[date][less_than]': getESTMidnightISO(addDays(date, 1)),
          })
          params.set('where[location][equals]', location.id)
          const href =
            d && !hasDoc
              ? isEvent
                ? listURLs.recurringEvent
                : listURLs.recurringFood
              : `${isEvent ? listURLs.event : listURLs.food}?${params}`
          return {
            date,
            food: Boolean(d?.food.length),
            event: Boolean(d?.events.length),
            closed,
            label: dayLabel(date, d, closed, today),
            href,
          }
        }),
      ),
    [weeks, byDay, closedDays, location.id, listURLs, today],
  )

  return (
    <div className="card widget-card schedule-heatmap">
      <div className="widget-card__header schedule-heatmap__header">
        <h3 id={`hm-title-${location.id}`} className="widget-card__title">
          {location.name}
        </h3>
        {/* Range and arrows stay together, so a narrow card wraps them as one group. */}
        <span className="schedule-heatmap__nav">
          <Button
            buttonStyle="ghost"
            disabled={page === PAGES_BACK}
            tooltip={page === PAGES_BACK ? undefined : 'Back to today'}
            onClick={() => setPage(PAGES_BACK)}
          >
            {`${monthName(from)} ${from.slice(0, 4)} – ${monthName(through)} ${through.slice(0, 4)}`}
          </Button>
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
      <div className="schedule-heatmap__status">
        <p className="schedule-heatmap__tonight">{tonight}</p>
        <Pill pillStyle={gaps ? 'warning' : 'success'} size="small">
          {gaps
            ? `${gaps} open ${plural(gaps, 'night', 'nights')} without food in the next 4 weeks`
            : 'Food booked every open night for the next 4 weeks'}
        </Pill>
      </div>
      <div
        role="grid"
        aria-labelledby={`hm-title-${location.id}`}
        className="schedule-heatmap__grid"
        style={{ '--hm-weeks': WEEKS } as CSSProperties}
        onMouseOver={(e) => setActive((e.target as HTMLElement).dataset.date ?? null)}
        onMouseLeave={() => setActive(null)}
        onFocus={(e) => setActive(e.target.dataset.date ?? null)}
        onBlur={() => setActive(null)}
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
        {DAY_NAMES.map((dow, d) => (
          <div role="row" key={dow} className="schedule-heatmap__row">
            <span role="rowheader" className="schedule-heatmap__dow">
              {dow}
            </span>
            {cells.map((week) => {
              const { date, label, href, ...marks } = week[d]
              return (
                <a
                  role="gridcell"
                  key={date}
                  href={href}
                  aria-label={label}
                  data-date={date}
                  {...markAttrs(marks)}
                  className={`schedule-heatmap__cell${date === today ? ' is-today' : ''}${date < today ? ' is-past' : ''}`}
                >
                  {/* aria-hidden: the cell's aria-label already reads the same text. */}
                  {date === active && (
                    <Tooltip aria-hidden delay={0}>
                      {label}
                    </Tooltip>
                  )}
                </a>
              )
            })}
          </div>
        ))}
      </div>
      <div className="schedule-heatmap__legend" aria-hidden="true">
        {LEGEND.map(({ label, ...marks }) => (
          <span key={label} className="schedule-heatmap__key">
            <span className="schedule-heatmap__swatch" {...markAttrs(marks)} /> {label}
          </span>
        ))}
      </div>
    </div>
  )
}
