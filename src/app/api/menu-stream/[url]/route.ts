import { NextRequest, NextResponse } from 'next/server'
import { getMenuByUrl } from '@/lib/utils/payload-api'
import { logger } from '@/lib/utils/logger'
import { getPittsburghTheme } from '@/lib/utils/pittsburgh-time'
import { unstable_cache } from 'next/cache'
import { CACHE_TAGS } from '@/lib/utils/cache'

/**
 * Cached menu fetch with tag-based invalidation
 * Cache is invalidated by the revalidateMenuCache hook when menu is updated
 */
const getCachedMenu = (url: string) =>
  unstable_cache(
    async () => {
      const menu = await getMenuByUrl(url)
      return { menu, _fetchedAt: Date.now() }
    },
    [`menu-stream-${url}`],
    {
      tags: [CACHE_TAGS.menus, `menu-${url}`],
      revalidate: 60, // Fallback revalidation every 60 seconds
    }
  )()

/**
 * Menu polling endpoint
 *
 * Returns menu data as JSON with caching headers.
 * Cache is invalidated on-demand when menu is updated in Payload.
 * Client polls this endpoint and compares timestamps to detect changes.
 *
 * Cost-effective design:
 * - CDN caches one response per menu URL (no query params to fragment cache)
 * - Only actual menu changes trigger fresh DB queries
 * - Adaptive client polling reduces idle-time requests
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ url: string }> }
) {
  const { url } = await params

  try {
    const cached = await getCachedMenu(url)

    if (!cached?.menu) {
      return NextResponse.json(
        { error: 'Menu not found' },
        { status: 404 }
      )
    }

    const { menu, _fetchedAt } = cached

    // Determine theme: use manual override if set, otherwise use Pittsburgh time
    const themeMode = menu.themeMode || 'auto'
    const theme = themeMode === 'auto' ? getPittsburghTheme() : themeMode

    // Use the max of menu's updatedAt and all populated item updatedAt timestamps
    // so changes to beers/products are detected even if the menu document itself hasn't changed
    let timestamp = menu.updatedAt ? new Date(menu.updatedAt).getTime() : Date.now()

    if (menu.items) {
      for (const item of menu.items) {
        const product = item.product?.value
        if (product && typeof product === 'object' && 'updatedAt' in product) {
          const itemTimestamp = new Date(product.updatedAt as string).getTime()
          if (itemTimestamp > timestamp) {
            timestamp = itemTimestamp
          }
        }
      }
    }

    const deployId = process.env.NEXT_PUBLIC_DEPLOY_ID || ''

    // Signal clients to poll faster when data was recently fetched fresh
    // (indicates an editor is active — cache was busted by afterRead hook)
    const warm = (Date.now() - _fetchedAt) < 60_000

    return NextResponse.json(
      {
        menu,
        theme,
        timestamp,
        deployId,
        warm,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        },
      }
    )
  } catch (error) {
    logger.error('Menu fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch menu' },
      { status: 500 }
    )
  }
}
