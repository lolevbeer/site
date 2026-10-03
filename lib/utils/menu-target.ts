/**
 * Turns a menu's saved revisions into a stock-vs-target timeline: each
 * revision is live from its save until the next one (the last until `end`),
 * and is judged by how far its item count sits from the target set at that
 * save. Over and under are equally bad, so `onTargetShare` counts only exact
 * hits, weighted by time live.
 */
export const DEFAULT_TARGET = 10

export type Revision = { updatedAt: string; items: number; target: number | null | undefined }
export type Segment = { start: number; end: number; diff: number }

export function stockTimeline(revisions: Revision[], end: number) {
  const segments: Segment[] = revisions.map((r, i) => ({
    start: Date.parse(r.updatedAt),
    end: i + 1 < revisions.length ? Date.parse(revisions[i + 1].updatedAt) : end,
    diff: r.items - (r.target ?? DEFAULT_TARGET),
  }))
  const total = segments.reduce((s, g) => s + g.end - g.start, 0)
  const onTarget = segments.reduce((s, g) => s + (g.diff === 0 ? g.end - g.start : 0), 0)
  return { segments, onTargetShare: total > 0 ? onTarget / total : 0 }
}

/** Rows with a product selected; empty rows are saved but hidden on the public menu. */
export const stockedCount = (items: { product?: unknown }[] | null | undefined) =>
  items?.filter((it) => it.product != null).length ?? 0

/** 'ok' on target, 'near' off by 1–2, 'far' off by 3+. */
export const severity = (diff: number) => (diff === 0 ? 'ok' : Math.abs(diff) <= 2 ? 'near' : 'far')
