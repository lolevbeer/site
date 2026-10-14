/**
 * Builds the /api/menu-stream JSON body from a menu. Shared by the cached
 * route and its uncached `/fresh` twin so both answer in the same shape and
 * compute the polling timestamp the same way.
 */
import type { PayloadMenu } from '@/lib/utils/payload-api'

export function menuStreamBody(menu: PayloadMenu) {
  // Include location edits (such as linesLastCleaned) and item edits even
  // when the menu document itself hasn't changed.
  let timestamp = menu.updatedAt ? new Date(menu.updatedAt).getTime() : 0
  if (menu.location && typeof menu.location === 'object' && menu.location.updatedAt) {
    timestamp = Math.max(timestamp, new Date(menu.location.updatedAt).getTime())
  }
  for (const item of menu.items ?? []) {
    const product = item.product?.value
    if (product && typeof product === 'object' && 'updatedAt' in product) {
      timestamp = Math.max(timestamp, new Date(product.updatedAt as string).getTime())
    }
  }

  return {
    menu,
    timestamp,
    deployId: process.env.NEXT_PUBLIC_DEPLOY_ID || '',
  }
}
