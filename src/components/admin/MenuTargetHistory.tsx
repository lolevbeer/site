/**
 * Admin dashboard widget: for each cans/draft menu, bars showing how many
 * items over (red, up) or under (amber, down) its targetItemCount it was at
 * each save in the last 90 days (target default 10). Reads menu version
 * history under the viewer's access, so each role sees only the menus and
 * revisions it may read.
 */
import type { WidgetServerProps } from 'payload'

import { getESTMidnightISO, getTodayEST } from '@/lib/utils/date'
import { addDays } from '@/lib/utils/schedule-heatmap'

const DEFAULT_TARGET = 10
const DAYS = 90
const W = 240
const H = 48

const diffColor = (d: number) =>
  d < 0 ? 'var(--theme-warning-500)' : d > 0 ? 'var(--theme-error-500)' : 'var(--theme-success-500)'
const diffLabel = (d: number) =>
  d === 0 ? 'on target' : `${Math.abs(d)} ${d < 0 ? 'under' : 'over'}`

export async function MenuTargetHistory({ req }: WidgetServerProps) {
  const { payload } = req
  const since = getESTMidnightISO(addDays(getTodayEST(), -DAYS))
  // ponytail: one unpaginated read; fine at a few saves per menu per day, paginate if it truncates.
  const [menus, versions] = await Promise.all([
    payload.find({
      collection: 'menus',
      where: { type: { in: ['cans', 'draft'] } },
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
  ])
  if (menus.docs.length === 0) return null

  return (
    <div className="card" style={{ display: 'grid', gap: 16, padding: 16 }}>
      <h3 style={{ margin: 0 }}>Stock vs target (last {DAYS} days)</h3>
      {menus.docs.map((menu) => {
        // Each save is judged against the target as it was at that save.
        const diffs = versions.docs
          .filter((v) => v.parent === menu.id)
          .map(
            (v) => (v.version.items?.length ?? 0) - (v.version.targetItemCount ?? DEFAULT_TARGET),
          )
        if (diffs.length === 0) return null
        const now = diffs[diffs.length - 1]
        const under = diffs.filter((d) => d < 0).length
        const over = diffs.filter((d) => d > 0).length
        const scale = Math.max(1, ...diffs.map(Math.abs))
        const mid = H / 2
        const bar = W / diffs.length
        return (
          <div key={menu.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{menu.name}</strong>
              <span style={{ color: diffColor(now) }}>{diffLabel(now)}</span>
            </div>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              height={H}
              preserveAspectRatio="none"
              role="img"
              aria-label={`${menu.name}: ${diffs.length} saves, ${under} under target, ${over} over, now ${diffLabel(now)}`}
            >
              {diffs.map((d, i) => {
                const h = d === 0 ? 1 : (Math.abs(d) / scale) * mid
                return (
                  <rect
                    key={i}
                    x={i * bar}
                    width={Math.max(bar - 1, 0.5)}
                    y={d > 0 ? mid - h : d < 0 ? mid : mid - 0.5}
                    height={h}
                    fill={diffColor(d)}
                  >
                    <title>{diffLabel(d)}</title>
                  </rect>
                )
              })}
              <line x1={0} x2={W} y1={mid} y2={mid} stroke="var(--theme-elevation-400)" />
            </svg>
            <small style={{ color: 'var(--theme-elevation-500)' }}>
              {under} of {diffs.length} saves understocked, {over} overstocked
            </small>
          </div>
        )
      })}
    </div>
  )
}
