/**
 * Admin dashboard widget: per location, one row per cans/draft menu showing
 * how much of the last 90 days it was stocked at its targetItemCount (default
 * 10). The strip is a time-proportional timeline of its revisions: green on
 * target, amber off by 1–2, red off by 3+; too many and too few count alike,
 * and each segment's tooltip says which. Reads locations, menus, and menu
 * version history under the viewer's access.
 */
import type { WidgetServerProps } from 'payload'

import { getESTMidnightISO, getTodayEST } from '@/lib/utils/date'
import { severity, stockTimeline } from '@/lib/utils/menu-target'
import { addDays } from '@/lib/utils/schedule-heatmap'
import { relationshipId } from '@/src/utils/relationship-id'

const DAYS = 90
const COLORS = {
  ok: 'var(--theme-success-500)',
  near: 'var(--theme-warning-500)',
  far: 'var(--theme-error-500)',
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

  const start = Date.parse(since)
  // Window runs to the end of today; segments past now render as the current state.
  const end = Date.parse(getESTMidnightISO(addDays(getTodayEST(), 1)))
  const span = end - start
  const pct = (t: number) => `${((Math.max(t, start) - start) / span) * 100}%`

  return (
    <div className="card" style={{ display: 'grid', gap: 20, padding: 16 }}>
      <h3 style={{ margin: 0 }}>Stocked at target, last {DAYS} days</h3>
      {locations.docs.map((location) => {
        const rows = menus.docs.filter((m) => relationshipId(m.location) === location.id)
        if (rows.length === 0) return null
        return (
          <section key={location.id} style={{ display: 'grid', gap: 10 }}>
            <h4 style={{ margin: 0 }}>{location.name}</h4>
            {rows.map((menu) => {
              const first = opening.get(menu.id)
              const { segments, onTargetShare } = stockTimeline(
                [
                  ...(first ? [{ ...first, updatedAt: since }] : []),
                  ...versions.docs.filter((v) => v.parent === menu.id),
                ].map((v) => ({
                  updatedAt: v.updatedAt,
                  items: v.version.items?.length ?? 0,
                  target: v.version.targetItemCount,
                })),
                end,
              )
              if (segments.length === 0) return null
              const now = segments[segments.length - 1].diff
              const label = `${location.name} ${TYPE_LABEL[menu.type] ?? menu.type}`
              return (
                <div key={menu.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{TYPE_LABEL[menu.type] ?? menu.type}</span>
                    <span>
                      <strong>{Math.round(onTargetShare * 100)}%</strong> on target · now{' '}
                      <span style={{ color: COLORS[severity(now)] }}>{diffLabel(now)}</span>
                    </span>
                  </div>
                  <div
                    role="img"
                    aria-label={`${label}: on target ${Math.round(onTargetShare * 100)}% of the time, now ${diffLabel(now)}`}
                    style={{
                      position: 'relative',
                      height: 12,
                      borderRadius: 3,
                      overflow: 'hidden',
                      background: 'var(--theme-elevation-100)',
                    }}
                  >
                    {segments.map((s, i) => (
                      <div
                        key={i}
                        title={`${new Date(s.start).toLocaleDateString()}: ${diffLabel(s.diff)}`}
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: pct(s.start),
                          width: `calc(${pct(s.end)} - ${pct(s.start)})`,
                          background: COLORS[severity(s.diff)],
                        }}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}
      <small style={{ color: 'var(--theme-elevation-500)' }}>
        Green on target · amber off by 1–2 · red off by 3+ (over or under). Gray means no saved
        revision covers that time.
      </small>
    </div>
  )
}
