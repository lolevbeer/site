/**
 * Admin dashboard widget: per location, Draft and Cans side by side, each a
 * step line of items on the menu across its saves in the last 90 days against
 * a dashed targetItemCount line (default 10). The item line is green on
 * target, amber off by 1–2, red off by 3+; too many and too few count alike,
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
  const H = 80

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
                const top = Math.max(...segments.flatMap((g) => [g.items, g.target]), 1) + 2
                const y = (n: number) => H - (n / top) * H
                const label = `${location.name} ${TYPE_LABEL[type]}`
                return (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
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
                      <svg
                        viewBox={`0 0 ${W} ${H}`}
                        width="100%"
                        height={H}
                        preserveAspectRatio="none"
                        role="img"
                        aria-label={`${label}: ${last.items} items, target ${last.target}, ${diffLabel(last.diff)}; on target ${Math.round(onTargetShare * 100)}% of the last ${DAYS} days`}
                        style={{ background: 'var(--color-bg-secondary)', borderRadius: 3 }}
                      >
                        {segments.map((g, i) => {
                          const next = segments[i + 1]
                          return (
                            <g key={i}>
                              <line
                                x1={x(g.start)}
                                x2={x(g.end)}
                                y1={y(g.target)}
                                y2={y(g.target)}
                                stroke="var(--color-text-secondary)"
                                strokeDasharray="4 3"
                                vectorEffect="non-scaling-stroke"
                              />
                              <line
                                x1={x(g.start)}
                                x2={x(g.end)}
                                y1={y(g.items)}
                                y2={y(g.items)}
                                stroke={COLORS[severity(g.diff)]}
                                strokeWidth={2.5}
                                vectorEffect="non-scaling-stroke"
                              >
                                <title>{`${new Date(g.start).toLocaleDateString()}: ${g.items} items, ${diffLabel(g.diff)}`}</title>
                              </line>
                              {next && (
                                <line
                                  x1={x(g.end)}
                                  x2={x(g.end)}
                                  y1={y(g.items)}
                                  y2={y(next.items)}
                                  stroke="var(--color-border)"
                                  vectorEffect="non-scaling-stroke"
                                />
                              )}
                            </g>
                          )
                        })}
                      </svg>
                    ) : (
                      <small>No saves yet</small>
                    )}
                    <small style={{ color: 'var(--color-text-secondary)' }}>
                      {Math.round(onTargetShare * 100)}% of the time on target since{' '}
                      {new Date(segments[0]?.start ?? end).toLocaleDateString()}
                    </small>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
      <small style={{ color: 'var(--color-text-secondary)' }}>
        Dashed line is the target. Item line: green on target, amber off by 1–2, red off by 3+ (over
        or under).
      </small>
    </div>
  )
}
