/**
 * Shared freshness helpers for menu/event polling routes.
 * Tag invalidation refreshes the data cache; this CDN policy is time-based.
 */

export const STREAM_CACHE_CONTROL =
  'public, max-age=0, s-maxage=30, stale-while-revalidate=60'
export const WARM_WINDOW_MS = 60_000

interface Timestamped {
  updatedAt?: string | null
}

interface MenuLike {
  updatedAt?: string | null
  items?: Array<{
    product?: { value?: Timestamped | string | null } | null
  } | null> | null
}

export function isWarm(contentTimestamp: number, now = Date.now()): boolean {
  return now - contentTimestamp < WARM_WINDOW_MS
}

export function contentTimestampFromMenu(menu: MenuLike, now = Date.now()): number {
  let timestamp = menu.updatedAt ? Date.parse(menu.updatedAt) : now
  if (!Number.isFinite(timestamp)) timestamp = now

  for (const item of menu.items || []) {
    const product = item?.product?.value
    if (product && typeof product === 'object' && product.updatedAt) {
      const itemTimestamp = Date.parse(product.updatedAt)
      if (Number.isFinite(itemTimestamp) && itemTimestamp > timestamp) {
        timestamp = itemTimestamp
      }
    }
  }

  return timestamp
}

export function contentTimestampFromEvents(events: Timestamped[]): number {
  let latest = 0
  for (const event of events) {
    if (!event.updatedAt) continue
    const time = Date.parse(event.updatedAt)
    if (Number.isFinite(time) && time > latest) latest = time
  }
  return latest
}
