/**
 * Admin dashboard widget: for each cans/draft menu, a sparkline of how many
 * items it carried at each save in the last 90 days against its targetItemCount
 * (default 10). Reads menu version history under the viewer's access, so each role
 * sees only the menus and revisions it may read.
 */
import type { WidgetServerProps } from 'payload'

import { getESTMidnightISO, getTodayEST } from '@/lib/utils/date'
import { addDays } from '@/lib/utils/schedule-heatmap'

const DEFAULT_TARGET = 10
const DAYS = 90
const W = 240
const H = 48

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
      <h3 style={{ margin: 0 }}>Menu size vs target (last {DAYS} days)</h3>
      {menus.docs.map((menu) => {
        const target = menu.targetItemCount ?? DEFAULT_TARGET
        const counts = versions.docs
          .filter((v) => v.parent === menu.id)
          .map((v) => v.version.items?.length ?? 0)
        if (counts.length === 0) return null
        const now = counts[counts.length - 1]
        const max = Math.max(target, ...counts) + 1
        const y = (n: number) => H - (n / max) * H
        const x = (i: number) => (counts.length === 1 ? W : (i / (counts.length - 1)) * W)
        const color =
          now < target
            ? 'var(--theme-warning-500)'
            : now > target
              ? 'var(--theme-error-500)'
              : 'var(--theme-success-500)'
        return (
          <div key={menu.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{menu.name}</strong>
              <span style={{ color }}>
                {now} / {target}
              </span>
            </div>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              height={H}
              preserveAspectRatio="none"
              role="img"
              aria-label={`${menu.name}: ${counts.length} saves, now ${now} items, target ${target}`}
            >
              <line
                x1={0}
                x2={W}
                y1={y(target)}
                y2={y(target)}
                stroke="var(--theme-elevation-400)"
                strokeDasharray="4 4"
              />
              <polyline
                points={counts.map((n, i) => `${x(i)},${y(n)}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        )
      })}
    </div>
  )
}
