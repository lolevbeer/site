/**
 * Admin dashboard widget: per location, Draft and Cans side by side, each a
 * step line of items on the menu across its saves in the last 90 days against
 * a dashed targetItemCount line (default 10). The item line is green on
 * target with gap shading one step redder per item off (yellow at 1, red at 6+); too many and too few count alike,
 * and each step's tooltip says which. Blank rows don't count. Reads locations, menus, and menu
 * version history under the viewer's access.
 */
import type { WidgetServerProps } from 'payload'

import { getESTMidnightISO, getTodayEST } from '@/lib/utils/date'
import { severity, stockedCount, stockTimeline } from '@/lib/utils/menu-target'
import { addDays } from '@/lib/utils/schedule-heatmap'
import { relationshipId } from '@/src/utils/relationship-id'

const DAYS = 90
const COLORS = {
  ok: 'var(--color-text-success)',
  near: 'var(--color-text-warning)',
  far: 'var(--color-text-danger)',
}
// Gap shading deepens one step per item off: yellow at 1, red at RED_AT+, over or under alike.
const RED_AT = 6
const gapFill = (diff: number) => {
  const t = Math.min((Math.abs(diff) - 1) / (RED_AT - 1), 1)
  return `color-mix(in oklab, var(--color-bg-danger) ${Math.round(t * 100)}%, var(--color-bg-warning))`
}
const TYPE_LABEL = { cans: 'Cans', draft: 'Draft' } as Record<string, string>

const diffLabel = (d: number) =>
  d === 0 ? 'on target' : `${Math.abs(d)} ${d < 0 ? 'under' : 'over'}`

export async function MenuTargetHistory({ req }: WidgetServerProps) {
  const { payload } = req
  const since = getESTMidnightISO(addDays(getTodayEST(), -DAYS))
  // ponytail: one unpaginated read; fine at a few saves per menu per day, paginate if it truncates.
  const [menus, versions, locations] = await Promise.all([
    payload.find({
      collection: 'menus',
      where: { type: { in: ['cans', 'draft'] } },
      sort: 'type',
      depth: 0,
      limit: 100,
      overrideAccess: false,
      req,
    }),
    payload.findVersions({
      collection: 'menus',
      where: { updatedAt: { greater_than_equal: since } },
      sort: 'updatedAt',
      depth: 0,
      limit: 2000,
      overrideAccess: false,
      req,
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

  // The newest save before the window is what each menu showed when it opened.
  const before = await Promise.all(
    menus.docs.map((menu) =>
      payload.findVersions({
        collection: 'menus',
        where: { parent: { equals: menu.id }, updatedAt: { less_than: since } },
        sort: '-updatedAt',
        depth: 0,
        limit: 1,
        overrideAccess: false,
        req,
      }),
    ),
  )
  const opening = new Map(menus.docs.map((menu, i) => [menu.id, before[i].docs[0]]))

  // Window runs to the end of today; segments past now render as the current state.
  const end = Date.parse(getESTMidnightISO(addDays(getTodayEST(), 1)))
  const W = 300
  const H = 96

  return (
    <div className="card" style={{ display: 'grid', gap: 20, padding: 16 }}>
      <h3 style={{ margin: 0 }}>Items vs target, last {DAYS} days</h3>
      {locations.docs.map((location) => {
        const forType = (type: string) =>
          menus.docs.find((m) => m.type === type && relationshipId(m.location) === location.id)
        const columns = (['draft', 'cans'] as const).map((type) => [type, forType(type)] as const)
        if (columns.every(([, menu]) => !menu)) return null
        return (
          <section key={location.id} style={{ display: 'grid', gap: 8 }}>
            <h4 style={{ margin: 0 }}>{location.name}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {columns.map(([type, menu]) => {
                if (!menu) return <div key={type} />
                const first = opening.get(menu.id)
                const { segments, onTargetShare } = stockTimeline(
                  [
                    ...(first ? [{ ...first, updatedAt: since }] : []),
                    ...versions.docs.filter((v) => v.parent === menu.id),
                  ].map((v) => ({
                    updatedAt: v.updatedAt,
                    items: stockedCount(v.version.items),
                    target: v.version.targetItemCount,
                  })),
                  end,
                )
                const last = segments[segments.length - 1]
                // Axis starts at this menu's first kept save, so pruned history isn't blank space.
                const from = segments[0]?.start ?? end
                const x = (t: number) => ((t - from) / Math.max(end - from, 1)) * W
                // Y spans the data around the target, padded by 1, so small misses are visible.
                const values = segments.flatMap((g) => [g.items, g.target])
                const lo = Math.max(0, Math.min(...values) - 1)
                const hi = Math.max(...values) + 1
                const y = (n: number) => H - ((n - lo) / Math.max(hi - lo, 1)) * H
                const label = `${location.name} ${TYPE_LABEL[type]}`
                // One continuous step path for items and one for the target.
                const step = (key: 'items' | 'target') =>
                  segments
                    .map((g, i) => `${i ? 'V' : 'M' + x(g.start) + ' '}${y(g[key])} H${x(g.end)}`)
                    .join(' ')
                return (
                  <div key={type}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <strong>{TYPE_LABEL[type]}</strong>
                      {last && (
                        <span>
                          {last.items} / {last.target} ·{' '}
                          <span style={{ color: COLORS[severity(last.diff)] }}>
                            {diffLabel(last.diff)}
                          </span>
                        </span>
                      )}
                    </div>
                    {last ? (
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
                        <svg
                          viewBox={`0 0 ${W} ${H}`}
                          width="100%"
                          height={H}
                          preserveAspectRatio="none"
                          role="img"
                          aria-label={`${label}: ${last.items} items, target ${last.target}, ${diffLabel(last.diff)}; on target ${Math.round(onTargetShare * 100)}% of the time`}
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
                                fill={gapFill(g.diff)}
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
                                stroke="var(--color-bg-success)"
                                strokeWidth={3}
                                vectorEffect="non-scaling-stroke"
                              />
                            ) : null,
                          )}
                          {/* Full-height hit areas so hovering anywhere over a save shows it. */}
                          {segments.map((g, i) => (
                            <rect
                              key={`hit${i}`}
                              x={x(g.start)}
                              width={Math.max(x(g.end) - x(g.start), 1)}
                              y={0}
                              height={H}
                              fill="transparent"
                            >
                              <title>{`${new Date(g.start).toLocaleDateString()}: ${g.items} items, target ${g.target}, ${diffLabel(g.diff)}`}</title>
                            </rect>
                          ))}
                        </svg>
                        <div />
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{new Date(segments[0].start).toLocaleDateString()}</span>
                          <span>Today</span>
                        </div>
                      </div>
                    ) : (
                      <small>No saves yet</small>
                    )}
                    <small style={{ color: 'var(--color-text-secondary)' }}>
                      On target {Math.round(onTargetShare * 100)}% of the time
                    </small>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
      <small style={{ color: 'var(--color-text-secondary)' }}>
        Solid line is items on the menu (green when on target), dashed is the target. Shading marks
        the gap: yellow at 1 off, one step redder per extra item, red at 6+, over or under.
      </small>
    </div>
  )
}
