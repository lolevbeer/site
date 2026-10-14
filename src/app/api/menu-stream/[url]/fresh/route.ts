import { NextRequest, NextResponse } from 'next/server'
import { menuStreamBody } from '@/lib/utils/menu-stream-response'
import { getMenuByUrlFresh } from '@/lib/utils/payload-api'

/**
 * Uncached twin of /api/menu-stream/[url], fetched by a display only when an
 * Ably "menu updated" push arrives (see usePolling's `invalidateUrl`).
 *
 * The save queues the push with after(), and Next starts the tag expiry in the
 * same step, so the tagged menu cache can still hold the previous menu when the
 * display's refetch lands. Reading the database directly guarantees the push
 * shows the saved menu. Ordinary safety polls keep using the cached route, so
 * this costs one database read per display per push, not per poll.
 */
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(_request: NextRequest, { params }: { params: Promise<{ url: string }> }) {
  const { url } = await params

  // A failed fetch throws (getMenuByUrlFresh logs it); the display treats that
  // like any failed poll and backs off.
  const menu = await getMenuByUrlFresh(url)

  if (!menu) {
    return NextResponse.json({ error: 'Menu not found' }, { status: 404, headers: NO_STORE })
  }

  return NextResponse.json(menuStreamBody(menu), { headers: NO_STORE })
}
