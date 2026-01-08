import { NextRequest, NextResponse } from 'next/server'
import { getMenuByUrl } from '@/lib/utils/payload-api'
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
      return menu
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
 * Client polls this endpoint every 1-2 seconds for near-instant updates.
 *
 * This is much more cost-effective than SSE because:
 * - Cached responses don't use CPU (served from edge cache)
 * - Only actual menu changes trigger fresh DB queries
 * - No persistent connections keeping functions alive
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ url: string }> }
) {
  const { url } = await params

  try {
    const menu = await getCachedMenu(url)

    if (!menu) {
      return NextResponse.json(
        { error: 'Menu not found' },
        { status: 404 }
      )
    }

    // Determine theme: use manual override if set, otherwise use Pittsburgh time
    const themeMode = menu.themeMode || 'auto'
    const theme = themeMode === 'auto' ? getPittsburghTheme() : themeMode

    return NextResponse.json(
      {
        menu,
        theme,
        timestamp: Date.now(),
      },
      {
        headers: {
          // Allow caching at edge, but revalidate frequently
          'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=10',
        },
      }
    )
  } catch (error) {
    console.error('Menu fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch menu' },
      { status: 500 }
    )
  }
}
