/**
 * Admin dashboard "Menu tracking" widget, in two views picked by the widget's
 * `view` setting (data only, default 'cards'):
 *
 * - 'cards': one card per targeted menu, worst current miss first (largest
 *   distance from target, then lowest share on target), each showing today's
 *   count of target, a Pill for the state (green on target, warning within 2,
 *   error beyond), a sparkline of item counts per save against a dashed target
 *   line, and % of days on target; the card links to the menu's edit page.
 *   Styled by MenuTargetHistory.scss on Payload's widget-card markup.
 * - 'chart': per location, Draft and Cans side by side, each a step line of
 *   items on the menu across its saves in the last 90 days against a dashed
 *   line at the menu's current targetItemCount (default 10), applied to every
 *   save so history is scored against today's target. The item line is green
 *   while on target; the gap to the target is shaded one step redder per item
 *   off (yellow at 1, red at 6+), too many and too few alike. Each step's
 *   tooltip names the save's date, counts, and who saved it; a dot marks
 *   today's count; locations are ordered by their worst current miss.
 *
 * Blank rows don't count. Data comes from `loadMenuTargets`
 * (lib/admin/menu-targets), read under the viewer's access.
 */
import { Pill } from '@payloadcms/ui'
import Link from 'next/link'
import type { WidgetServerProps } from 'payload'
import type { MenuTargetHistoryWidget } from '@/src/payload-types'
import type { ReactElement } from 'react'
import { formatAdminURL } from 'payload/shared'

import {
  loadMenuTargets,
  scaleY,
  sparklinePoints,
  summarizeMenuTarget,
  type MenuTargets,
  type MenuTargetSummary,
  type MenuTimeline,
} from '@/lib/admin/menu-targets'
import { getDateEST } from '@/lib/utils/date'
import { formatDate } from '@/lib/utils/formatters'
import { fillFor, MENU_TYPE_LABEL, TARGETED_MENU_TYPES } from '@/lib/utils/menu-target'
import './dashboard-widgets.scss'
import './MenuTargetHistory.scss'

const W = 300
const H = 96
const SPARK_W = 120
const SPARK_H = 32

const diffLabel = (d: number) =>
  d === 0 ? 'on target' : `${Math.abs(d)} ${d < 0 ? 'under' : 'over'}`
const dayLabel = (t: number) => formatDate(getDateEST(t))

export async function MenuTargetHistory({
  req,
  widgetData,
}: WidgetServerProps<MenuTargetHistoryWidget>): Promise<ReactElement | null> {
  const data = await loadMenuTargets(req)
  if (!data) return null
  if (widgetData?.view === 'chart') return <MenuTargetChart data={data} />
  return <MenuTargetCards data={data} adminRoute={req.payload.config.routes.admin} />
}

type Card = { id: string; name: string; location: string; summary: MenuTargetSummary | null }

/** Worst miss first: largest distance from target, then lowest share on target; no saves last. */
function byWorstMiss(a: Card, b: Card): number {
  if (!a.summary || !b.summary) return (a.summary ? 0 : 1) - (b.summary ? 0 : 1)
  return (
    Math.abs(b.summary.diff) - Math.abs(a.summary.diff) ||
    a.summary.shareOnTarget - b.summary.shareOnTarget
  )
}

/** Pill text and style for a menu's current state. */
function statePill(summary: MenuTargetSummary): {
  text: string
  style: 'success' | 'warning' | 'error'
} {
  if (summary.diff === 0) return { text: 'On target', style: 'success' }
  return {
    text: diffLabel(summary.diff),
    style: Math.abs(summary.diff) <= 2 ? 'warning' : 'error',
  }
}

/** Default view: one linked card per menu, worst miss first. */
function MenuTargetCards({
  data,
  adminRoute,
}: {
  data: MenuTargets
  adminRoute: string
}): ReactElement {
  const timelines = new Map(data.timelines)
  const cards: Card[] = data.rows
    .flatMap(({ location, atLocation }) =>
      atLocation.map((menu) => {
        const timeline = timelines.get(menu.id)
        return {
          id: menu.id,
          name: menu.name,
          location: location.name,
          summary: timeline ? summarizeMenuTarget(timeline) : null,
        }
      }),
    )
    .sort(byWorstMiss)

  return (
    <div className="card widget-card lolev-widget menu-targets">
      <div className="widget-card__header">
        <h3 className="widget-card__title">Menu tracking</h3>
      </div>
      <ul className="menu-targets__cards">
        {cards.map(({ id, name, location, summary }) => {
          const pill = summary && statePill(summary)
          const spark = summary && sparklinePoints(summary.series, summary.target, SPARK_W, SPARK_H)
          return (
            <li key={id}>
              <Link
                className="menu-targets__card"
                href={formatAdminURL({
                  adminRoute,
                  path: `/collections/menus/${encodeURIComponent(id)}`,
                })}
              >
                <span className="menu-targets__head">
                  <strong className="menu-targets__name">{name}</strong>
                  <span className="menu-targets__location">{location}</span>
                </span>
                {summary && pill && spark ? (
                  <>
                    <span className="menu-targets__state">
                      <span className="menu-targets__count">
                        {summary.count} of {summary.target}
                      </span>
                      <Pill pillStyle={pill.style} size="small">
                        {pill.text}
                      </Pill>
                    </span>
                    <svg
                      className="menu-targets__spark"
                      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
                      preserveAspectRatio="none"
                      role="img"
                      aria-label={`${name}: ${summary.count} items, target ${summary.target}`}
                    >
                      <line
                        className="menu-targets__spark-target"
                        x1={0}
                        x2={SPARK_W}
                        y1={spark.targetY}
                        y2={spark.targetY}
                      />
                      <polyline className="menu-targets__spark-line" points={spark.points} />
                    </svg>
                    <span className="menu-targets__share">
                      {summary.shareOnTarget}% of days on target
                    </span>
                  </>
                ) : (
                  <span className="menu-targets__share">No saves yet</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** 'chart' view: per location, Draft and Cans step charts side by side. */
function MenuTargetChart({ data }: { data: MenuTargets }): ReactElement {
  const { rows, end } = data
  const timelines = new Map(data.timelines)
  const names = new Map(data.names)
  return (
    // Payload's widget-card chrome, like the built-in and Schedule widgets;
    // max-height: none because widget-card caps height for list rows.
    <div className="card widget-card" style={{ display: 'grid', gap: 20, maxHeight: 'none' }}>
      <div className="widget-card__header">
        <h3 className="widget-card__title">Menu tracking</h3>
      </div>
      {rows.map(({ location, atLocation }) => (
        <section key={location.id} style={{ display: 'grid', gap: 8 }}>
          <h4 style={{ margin: 0 }}>{location.name}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {TARGETED_MENU_TYPES.map((type) => {
              const menu = atLocation.find((m) => m.type === type)
              const timeline = menu && timelines.get(menu.id)
              return timeline ? (
                <MenuChart
                  key={type}
                  label={`${location.name} ${MENU_TYPE_LABEL[type]}`}
                  title={MENU_TYPE_LABEL[type]}
                  end={end}
                  names={names}
                  {...timeline}
                />
              ) : (
                <div key={type} />
              )
            })}
          </div>
        </section>
      ))}
      <small style={{ color: 'var(--color-text-secondary)' }}>
        Solid: items. Dashed: target. Hover for each save.
      </small>
    </div>
  )
}

/** One menu's step chart, header, and on-target share. */
function MenuChart({
  label,
  title,
  segments,
  onTargetShare,
  end,
  names,
}: MenuTimeline & {
  label: string
  title: string
  end: number
  names: Map<string, string>
}) {
  const last = summarizeMenuTarget({ segments, onTargetShare })
  if (!last) {
    return (
      <div>
        <strong>{title}</strong>
        <small style={{ display: 'block' }}>No saves yet</small>
      </div>
    )
  }
  // Axis starts at this menu's first kept save, so pruned history isn't blank space.
  const from = segments[0].start
  const x = (t: number) => ((t - from) / Math.max(end - from, 1)) * W
  // Y spans the data around the target, padded by 1, so small misses are visible.
  const { lo, hi, y } = scaleY(
    segments.flatMap((g) => [g.items, g.target]),
    H,
  )
  const step = (key: 'items' | 'target') =>
    segments.map((g, i) => `${i ? 'V' : 'M' + x(g.start) + ' '}${y(g[key])} H${x(g.end)}`).join(' ')
  const share = last.shareOnTarget

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <strong>{title}</strong>
        <span>
          {last.count} / {last.target} · {/* Text stays in ink; the swatch carries the color. */}
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: 2,
              marginRight: 4,
              background: fillFor(last.diff),
            }}
          />
          {diffLabel(last.diff)}
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.5em 1fr',
          columnGap: 4,
          rowGap: 6,
          fontSize: 11,
          color: 'var(--color-text-secondary)',
        }}
      >
        <div style={{ position: 'relative', height: H }}>
          {[hi, last.target, lo]
            .filter((n) => n === last.target || Math.abs(n - last.target) >= 2)
            .map((n) => (
              <span
                key={n}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: y(n),
                  transform: 'translateY(-50%)',
                  fontWeight: n === last.target ? 600 : undefined,
                }}
              >
                {n}
              </span>
            ))}
        </div>
        <div style={{ position: 'relative' }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height={H}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${label}: ${last.count} items, target ${last.target}, ${diffLabel(last.diff)}; on target ${share}% of the time`}
            style={{ overflow: 'visible' }}
          >
            {segments.map((g, i) =>
              g.diff === 0 ? null : (
                <rect
                  key={`gap${i}`}
                  x={x(g.start)}
                  width={x(g.end) - x(g.start)}
                  y={Math.min(y(g.items), y(g.target))}
                  height={Math.abs(y(g.items) - y(g.target))}
                  fill={fillFor(g.diff)}
                  fillOpacity={0.55}
                />
              ),
            )}
            <path
              d={step('target')}
              fill="none"
              stroke="var(--color-text-secondary)"
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={step('items')}
              fill="none"
              stroke="var(--color-text)"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {/* On-target stretches drawn green over the item line. */}
            {segments.map((g, i) =>
              g.diff === 0 ? (
                <line
                  key={`ok${i}`}
                  x1={x(g.start)}
                  x2={x(g.end)}
                  y1={y(g.items)}
                  y2={y(g.items)}
                  stroke={fillFor(0)}
                  strokeWidth={3}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null,
            )}
            {/* Full-height hit areas so hovering anywhere over a save shows it. */}
            {segments.map((g, i) => {
              const who = g.editor && names.get(g.editor)
              return (
                <rect
                  key={`hit${i}`}
                  x={x(g.start)}
                  width={Math.max(x(g.end) - x(g.start), 1)}
                  y={0}
                  height={H}
                  fill="transparent"
                >
                  <title>
                    {`${dayLabel(g.start)}: ${g.items} items, target ${g.target}, ${diffLabel(g.diff)}${who ? ` · saved by ${who}` : ''}`}
                  </title>
                </rect>
              )
            })}
          </svg>
          {/* Today's count, so the eye lands on now. */}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              right: -5,
              top: y(last.count) - 5,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: fillFor(last.diff),
              boxShadow: '0 0 0 2px var(--color-bg-secondary), 0 0 0 3px var(--color-text)',
            }}
          />
        </div>
        <div />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{dayLabel(from)}</span>
          <span>Today</span>
        </div>
      </div>
      <small style={{ color: 'var(--color-text-secondary)' }}>{share}% on target</small>
    </div>
  )
}
