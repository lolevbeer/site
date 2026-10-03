/**
 * Turns a menu's saved revisions into a stock-vs-target timeline: each
 * revision is live from its save until the next one (the last until `end`),
 * and is judged by how far its item count sits from one `target` (the menu's
 * current target, so history is scored against today's goal). Over and under are equally bad, so `onTargetShare` counts only exact
 * hits, weighted by time live.
 */
export const DEFAULT_TARGET = 10
/** Menu types that carry a targetItemCount; others (e.g. 'other') aren't tracked. */
export const TARGETED_MENU_TYPES = ['draft', 'cans'] as const

export type Revision = {
  updatedAt: string
  items: number
  /** User ID of whoever saved it (menus' updatedBy), if known. */
  editor?: string
}
export type Segment = {
  start: number
  end: number
  items: number
  target: number
  diff: number
  editor?: string
}

export function stockTimeline(revisions: Revision[], target: number, end: number) {
  const segments: Segment[] = revisions.map((r, i) => {
    return {
      start: Date.parse(r.updatedAt),
      end: i + 1 < revisions.length ? Date.parse(revisions[i + 1].updatedAt) : end,
      items: r.items,
      target,
      diff: r.items - target,
      editor: r.editor,
    }
  })
  const total = segments.reduce((s, g) => s + g.end - g.start, 0)
  const onTarget = segments.reduce((s, g) => s + (g.diff === 0 ? g.end - g.start : 0), 0)
  return { segments, onTargetShare: total > 0 ? onTarget / total : 0 }
}

/** Rows with a product selected; empty rows are saved but hidden on the public menu. */
export const stockedCount = (items: { product?: unknown }[] | null | undefined) =>
  items?.filter((it) => it.product != null).length ?? 0

// Off-target shading deepens one step per item off, yellow at 1 to red at RED_AT+.
const RED_AT = 6

/** Color for a distance from target: green on target, else yellow→red by size, over or under alike. */
export function fillFor(diff: number) {
  if (diff === 0) return 'var(--color-bg-success)'
  const t = Math.min((Math.abs(diff) - 1) / (RED_AT - 1), 1)
  return `color-mix(in oklab, var(--color-bg-danger) ${Math.round(t * 100)}%, var(--color-bg-warning))`
}

/** Largest distance from target among `diffs` (-1 when empty), for worst-first ordering. */
export const worstMiss = (diffs: number[]) => Math.max(-1, ...diffs.map(Math.abs))
