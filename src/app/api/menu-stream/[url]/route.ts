import { NextRequest, NextResponse } from 'next/server'
import { getMenuByUrl } from '@/lib/utils/payload-api'
import { logger } from '@/lib/utils/logger'
import { getPittsburghTheme } from '@/lib/utils/pittsburgh-time'
import {
  STREAM_CACHE_CONTROL,
  contentTimestampFromMenu,
  isWarm,
} from '@/lib/utils/stream-freshness'

/**
 * Menu polling endpoint.
 *
 * One tagged data-cache layer (`getMenuByUrl`). The HTTP CDN object is
 * independent of tag invalidation and uses STREAM_CACHE_CONTROL.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ url: string }> }) {
  const { url } = await params

  try {
    const menu = await getMenuByUrl(url)

    if (!menu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    const themeMode = menu.themeMode || 'auto'
    const theme = themeMode === 'auto' ? getPittsburghTheme() : themeMode
    const timestamp = contentTimestampFromMenu(menu)
    const deployId = process.env.NEXT_PUBLIC_DEPLOY_ID || ''
    const warm = isWarm(timestamp)

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
          'Cache-Control': STREAM_CACHE_CONTROL,
        },
      },
    )
  } catch (error) {
    logger.error('Menu fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch menu' }, { status: 500 })
  }
}
