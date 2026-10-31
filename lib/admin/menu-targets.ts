/**
 * Menu stock-vs-target data for the admin dashboard: `loadMenuTargets` reads
 * every targeted menu's saves over the last 90 days as the viewer (cached per
 * user) and groups them by location, worst current miss first;
 * `summarizeMenuTarget` reduces one menu's timeline to the figures a card shows;
 * `scaleY` and `sparklinePoints` turn item counts into SVG geometry.
 */
import { unstable_cache } from 'next/cache'
import type { PayloadRequest } from 'payload'

import { accessKey, CACHE_TAGS } from '@/lib/utils/cache'
import { getESTMidnightISO, getTodayEST } from '@/lib/utils/date'
import {
  DEFAULT_TARGET,
  stockedCount,
  stockTimeline,
  TARGETED_MENU_TYPES,
  worstMiss,
  type Segment,
} from '@/lib/utils/menu-target'
import { addDays } from '@/lib/utils/schedule-heatmap'
import { editorNames } from '@/src/components/admin/editor-names'
import type { Location, Menu } from '@/src/payload-types'
import { relationshipId } from '@/src/utils/relationship-id'

const DAYS = 90
// Only what the timeline reads; versions otherwise carry every menu field.
const VERSION_SELECT = {
  parent: true,
  updatedAt: true,
  version: { items: { product: true }, updatedBy: true },
} as const

export type MenuTimeline = { segments: Segment[]; onTargetShare: number }
export type TargetMenu = Pick<Menu, 'id' | 'name' | 'type' | 'location' | 'targetItemCount'>
export type MenuTargets = {
  /** Locations with at least one targeted menu, worst current miss first. */
  rows: { location: Pick<Location, 'id' | 'name'>; atLocation: TargetMenu[]; worst: number }[]
  /** End of today (ms); the last save holds until then. */
  end: number
  /** Menu ID → timeline, as entries so the result caches as plain JSON. */
  timelines: [string, MenuTimeline][]
  /** Editor user ID → display name, as entries. */
  names: [string, string][]
}

/**
 * `readMenuTargets`, cached per user (menu read access varies by role and
 * location). The revalidation plugin clears 'menus' on every published save;
 * `today` in the key rolls the 90-day window at EST midnight.
 */
export function loadMenuTargets(req: PayloadRequest): Promise<MenuTargets | null> {
  return unstable_cache(
    () => readMenuTargets(req),
    ['dashboard-menu-target-v2', accessKey(req), getTodayEST()],
    { tags: [CACHE_TAGS.menus, CACHE_TAGS.locations], revalidate: 3600 },
  )()
}

/** Every targeted menu's timeline, read as the viewer; null when they can read none. */
export async function readMenuTargets(req: PayloadRequest): Promise<MenuTargets | null> {
  const { payload } = req
  const since = getESTMidnightISO(addDays(getTodayEST(), -DAYS))
  const versionQuery = { collection: 'menus', select: VERSION_SELECT, depth: 0, req } as const
  // ponytail: unpaginated reads; fine at a few saves per menu per day (maxPerDoc 1000).
  const [menus, versions, older, locations] = await Promise.all([
    payload.find({
      collection: 'menus',
      where: { type: { in: [...TARGETED_MENU_TYPES] } },
      select: { name: true, type: true, location: true, targetItemCount: true },
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
      select: { name: true },
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
    const list = byMenu.get(id)
    if (list) list.push(v)
    else byMenu.set(id, [v])
  }
  const timelines = new Map(
    menus.docs.map((menu) => [
      menu.id,
      stockTimeline(
        (byMenu.get(menu.id) ?? []).map((v) => ({
          updatedAt: v.updatedAt,
          items: stockedCount(v.version.items),
          editor: v.version.updatedBy ? relationshipId(v.version.updatedBy) : undefined,
        })),
        menu.targetItemCount ?? DEFAULT_TARGET,
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

export type MenuTargetSummary = {
  /** Items on the menu now (latest save). */
  count: number
  target: number
  /** count − target: negative under, positive over. */
  diff: number
  state: 'on' | 'under' | 'over'
  /** Whole percent of the window spent exactly on target, time-weighted. */
  shareOnTarget: number
  /** Item count per save, oldest first, for a sparkline. */
  series: number[]
}

/**
 * One menu's timeline as the figures a card shows; null when the menu has no
 * saves. The target is read from the segments, which all carry the menu's current target.
 */
export function summarizeMenuTarget({
  segments,
  onTargetShare,
}: MenuTimeline): MenuTargetSummary | null {
  const last = segments.at(-1)
  if (!last) return null
  return {
    count: last.items,
    target: last.target,
    diff: last.diff,
    state: last.diff === 0 ? 'on' : last.diff < 0 ? 'under' : 'over',
    shareOnTarget: Math.round(onTargetShare * 100),
    series: segments.map((g) => g.items),
  }
}

/**
 * Vertical scale for item counts drawn `height` tall: spans `values` padded by
 * 1 (never below 0) so small misses stay visible; `y` maps a count to an SVG y.
 */
export function scaleY(
  values: number[],
  height: number,
): { lo: number; hi: number; y: (n: number) => number } {
  const lo = Math.max(0, Math.min(...values) - 1)
  const hi = Math.max(...values) + 1
  return { lo, hi, y: (n) => height - ((n - lo) / Math.max(hi - lo, 1)) * height }
}

/**
 * A card's sparkline: `points` for an SVG polyline through each save's item
 * count, evenly spaced across `width` (one save draws a flat line), and the y
 * of the dashed `target` line, on the same scale as the full chart.
 */
export function sparklinePoints(
  series: number[],
  target: number,
  width: number,
  height: number,
): { points: string; targetY: number } {
  const { y } = scaleY([...series, target], height)
  const values = series.length === 1 ? [series[0], series[0]] : series
  const points = values
    .map((n, i) => `${(i / Math.max(values.length - 1, 1)) * width},${y(n)}`)
    .join(' ')
  return { points, targetY: y(target) }
}
