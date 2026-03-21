import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import payloadConfig from '@/src/payload.config'
import { getMenuByUrl } from '@/lib/utils/payload-api'
import { logger } from '@/lib/utils/logger'
import { getPittsburghTheme } from '@/lib/utils/pittsburgh-time'
import { unstable_cache } from 'next/cache'
import { CACHE_TAGS } from '@/lib/utils/cache'
import { getNowPlaying, type NowPlaying } from '@/lib/utils/spotify'

/** In-memory cache for location refresh tokens (rarely changes) */
const refreshTokenCache = new Map<string, { token: string | null; expiresAt: number }>()
const TOKEN_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/** In-memory cache for now playing results (avoid hammering Spotify) */
const nowPlayingCache = new Map<string, { data: NowPlaying | null; expiresAt: number }>()
const NOW_PLAYING_CACHE_TTL = 10 * 1000 // 10 seconds

/**
 * Get Spotify now playing for a menu's location.
 * Caches the refresh token lookup (5min) and the now playing result (10s).
 */
async function getLocationNowPlaying(
  location: string | { id: string; spotifyRefreshToken?: string | null } | null | undefined
): Promise<NowPlaying | null> {
  try {
    const locationId = typeof location === 'object' ? location?.id : location
    if (!locationId) return null

    // Check refresh token cache
    let refreshToken: string | null = null
    const cachedToken = refreshTokenCache.get(locationId)
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
      refreshToken = cachedToken.token
    } else {
      const payload = await getPayload({ config: payloadConfig })
      const loc = await payload.findByID({
        collection: 'locations',
        id: locationId,
        overrideAccess: true,
      })
      refreshToken = loc?.spotifyRefreshToken || null
      refreshTokenCache.set(locationId, { token: refreshToken, expiresAt: Date.now() + TOKEN_CACHE_TTL })
    }

    if (!refreshToken) return null

    // Check now playing cache
    const cachedNowPlaying = nowPlayingCache.get(locationId)
    if (cachedNowPlaying && cachedNowPlaying.expiresAt > Date.now()) {
      return cachedNowPlaying.data
    }

    const result = await getNowPlaying(refreshToken)
    nowPlayingCache.set(locationId, { data: result, expiresAt: Date.now() + NOW_PLAYING_CACHE_TTL })
    return result
  } catch (err) {
    logger.error('Spotify fetch error in menu-stream:', err)
    return null
  }
}

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

    // Fetch Spotify now playing, cached 10s to avoid hammering the API
    const nowPlaying = await getLocationNowPlaying(menu.location)

    return NextResponse.json(
      {
        menu,
        theme,
        timestamp,
        deployId,
        warm,
        nowPlaying,
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
