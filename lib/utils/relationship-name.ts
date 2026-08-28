/**
 * Display names for Payload relationship fields.
 *
 * A relationship arrives either populated (the document) or as a bare ID
 * string, depending on the query depth. Several beer surfaces unwrapped that
 * union inline to reach `.name`; these helpers are the single home for that
 * idiom so the fallbacks stay consistent between the adapter and the UI.
 */

import type { Style } from '@/src/payload-types'

/**
 * Name of a populated relationship, or the raw ID when it is unpopulated so
 * callers still have something renderable. `undefined` when nothing is set.
 */
export function relationshipName(
  value: string | { name?: string | null } | null | undefined,
): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value
  return value.name ?? undefined
}

/**
 * Beer style name for display. Returns an empty string when the beer has no
 * style, so it can be rendered and truth-tested directly.
 */
export function getStyleName(style: string | Style | null | undefined): string {
  return relationshipName(style) || ''
}
