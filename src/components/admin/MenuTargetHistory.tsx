/**
 * Admin dashboard widget: per location, Draft and Cans side by side, each a
 * step line of items on the menu across its saves in the last 90 days against
 * a dashed line at the menu's current targetItemCount (default 10), applied to
 * every save so history is scored against today's target. The item line is green while on
 * target; the gap to the target is shaded one step redder per item off (yellow
 * at 1, red at 6+), too many and too few alike. Each step's tooltip names the
 * save's date, counts, and who saved it; a dot marks today's count; locations
 * are ordered by their worst current miss. Blank rows don't count. Reads
 * locations, menus, menu versions, and editor names under the viewer's access.
 */
import { unstable_cache } from 'next/cache'
import type { WidgetServerProps } from 'payload'

import { CACHE_TAGS } from '@/lib/utils/cache'

import { getDateEST, getESTMidnightISO, getTodayEST } from '@/lib/utils/date'
import { formatDate } from '@/lib/utils/formatters'
import {
  fillFor,
  stockedCount,
  stockTimeline,
  TARGETED_MENU_TYPES,
  worstMiss,
  type Segment,
} from '@/lib/utils/menu-target'
import { addDays } from '@/lib/utils/schedule-heatmap'
import { relationshipId } from '@/src/utils/relationship-id'

import { editorNames } from './editor-names'

const DAYS = 90
const W = 300
const H = 96
const TYPE_LABEL: Record<string, string> = { cans: 'Cans', draft: 'Draft' }
// Only what the timeline reads; versions otherwise carry every menu field.
const VERSION_SELECT = {
  parent: true,
  updatedAt: true,
  version: { items: { product: true }, updatedBy: true },
} as const

const diffLabel = (d: number) =>
  d === 0 ? 'on target' : `${Math.abs(d)} ${d < 0 ? 'under' : 'over'}`
const dayLabel = (t: number) => formatDate(getDateEST(t))

/**
 * The widget's data, cached per user (menu read access varies by role and
 * location) as plain JSON: Maps become entry arrays. The revalidation plugin
 * clears 'menus' on every published save; `today` in the key rolls the 90-day
 * window at EST midnight.
 */
const loadMenuTargets = (req: WidgetServerProps['req']) =>
  unstable_cache(
    () => readMenuTargets(req),
    ['dashboard-menu-target-v1', String(req.user?.id), getTodayEST()],
    { tags: [CACHE_TAGS.menus, CACHE_TAGS.locations], revalidate: 3600 },
  )()

async function readMenuTargets(req: WidgetServerProps['req']) {
  const { payload } = req
  const since = getESTMidnightISO(addDays(getTodayEST(), -DAYS))
  const versionQuery = { collection: 'menus', select: VERSION_SELECT, depth: 0, req } as const
  // ponytail: unpaginated reads; fine at a few saves per menu per day (maxPerDoc 1000).
  const [menus, versions, older, locations] = await Promise.all([
    payload.find({
      collection: 'menus',
      where: { type: { in: [...TARGETED_MENU_TYPES] } },
      depth: 0,
      limit: 100,
      overrideAccess: false,
      req,
    }),
    payload.findVersions({
      ...versionQuery,
      where: { updatedAt: { greater_than_equal: since } },
      sort: 'updatedAt',
      limit: 2000,
      overrideAccess: false,
    }),
    // Newest-first saves before the window; the first per menu is its opening state.
    payload.findVersions({
      ...versionQuery,
      where: { updatedAt: { less_than: since } },
      sort: '-updatedAt',
      limit: 2000,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'locations',
      sort: 'name',
      depth: 0,
      limit: 100,
      overrideAccess: false,
      req,
    }),
  ])
  if (menus.docs.length === 0) return null

  // Window runs to the end of today; the last save holds until then.
  const end = Date.parse(getESTMidnightISO(addDays(getTodayEST(), 1)))
  const byMenu = new Map<string, (typeof versions.docs)[number][]>()
  for (const v of older.docs) {
    const id = String(v.parent)
    if (!byMenu.has(id)) byMenu.set(id, [{ ...v, updatedAt: since }])
  }
  for (const v of versions.docs) {
    const id = String(v.parent)
    byMenu.set(id, [...(byMenu.get(id) ?? []), v])
  }
  const timelines = new Map(
    menus.docs.map((menu) => [
      menu.id,
      stockTimeline(
        (byMenu.get(menu.id) ?? []).map((v) => ({
          updatedAt: v.updatedAt,
          items: stockedCount(v.version.items),
          target: menu.targetItemCount,
          editor: v.version.updatedBy ? relationshipId(v.version.updatedBy) : undefined,
        })),
        end,
      ),
    ]),
  )
  const names = await editorNames(
    req,
    [...timelines.values()].flatMap((t) => t.segments.map((g) => g.editor)),
  )

  // Each location's menus by type, ordered by their worst current miss.
  const rows = locations.docs
    .map((location) => {
      const atLocation = menus.docs.filter((m) => relationshipId(m.location) === location.id)
      const worst = worstMiss(
        atLocation.map((m) => timelines.get(m.id)?.segments.at(-1)?.diff ?? 0),
      )
      return { location, atLocation, worst }
    })
    .filter((r) => r.atLocation.length > 0)
    .sort((a, b) => b.worst - a.worst)

  return { rows, end, timelines: [...timelines], names: [...names] }
}

export async function MenuTargetHistory({ req }: WidgetServerProps) {
  const data = await loadMenuTargets(req)
  if (!data) return null
  const { rows, end } = data
  const timelines = new Map(data.timelines)
  const names = new Map(data.names)
  return (
    <div className="card" style={{ display: 'grid', gap: 20, padding: 16 }}>
      <h3 style={{ margin: 0 }}>Items vs target, last {DAYS} days</h3>
      <small style={{ color: 'var(--color-text-secondary)', marginTop: -12 }}>
        Furthest off target first. Hover a line for each save and who made it.
      </small>
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
                  label={`${location.name} ${TYPE_LABEL[type]}`}
                  title={TYPE_LABEL[type]}
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
        Solid line is items on the menu (green when on target), dashed is the target. Shading marks
        the gap: yellow at 1 off, one step redder per extra item, red at 6+, over or under.
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
}: {
  label: string
  title: string
  segments: Segment[]
  onTargetShare: number
  end: number
  names: Map<string, string>
}) {
  const last = segments.at(-1)
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
  const values = segments.flatMap((g) => [g.items, g.target])
  const lo = Math.max(0, Math.min(...values) - 1)
  const hi = Math.max(...values) + 1
  const y = (n: number) => H - ((n - lo) / Math.max(hi - lo, 1)) * H
  const step = (key: 'items' | 'target') =>
    segments.map((g, i) => `${i ? 'V' : 'M' + x(g.start) + ' '}${y(g[key])} H${x(g.end)}`).join(' ')
  const share = Math.round(onTargetShare * 100)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <strong>{title}</strong>
        <span>
          {last.items} / {last.target} · {/* Text stays in ink; the swatch carries the color. */}
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
            aria-label={`${label}: ${last.items} items, target ${last.target}, ${diffLabel(last.diff)}; on target ${share}% of the time`}
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
              top: y(last.items) - 5,
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
      <small style={{ color: 'var(--color-text-secondary)' }}>On target {share}% of the time</small>
    </div>
  )
}
