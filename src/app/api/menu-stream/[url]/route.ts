import { NextRequest, NextResponse } from 'next/server'
import { menuStreamBody } from '@/lib/utils/menu-stream-response'
import { getMenuByUrl } from '@/lib/utils/payload-api'

/**
 * Menu polling endpoint for the /m displays.
 *
 * Cached on Vercel's CDN until the menu changes, so a display's poll almost
 * never runs this function:
 * - `force-static` with no prerendered params caches each menu URL on its
 *   first request.
 * - getMenuByUrl's cache tags (`menus`, `kiosk-menus`, `menu-<url>`) attach to
 *   that cached response, so the Payload hooks expire it when a menu, its
 *   location or a product (`kiosk-menus`) or a beer on it (`menu-<url>`)
 *   changes. `kiosk-menus` and `menu-<url>` are hard-expired, so the first
 *   fetch after the save gets the fresh menu, including the fetch triggered by
 *   an Ably notification.
 * - The 10-minute fallback refresh bounds how long a new deployment's
 *   `deployId` (which reloads displays) takes to reach them.
 *
 * A display told to refetch by an Ably push uses the uncached `./fresh` route
 * instead; see there for why.
 *
 * The response depends only on the menu, never the clock, so it stays
 * cacheable: displays work out their day/night theme themselves.
 */
export const dynamic = 'force-static'
export const revalidate = 600

/** No menus are prerendered at build; each is cached on its first request. */
export function generateStaticParams() {
  return []
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ url: string }> }) {
  const { url } = await params

  // A failed fetch throws (getMenuByUrl logs it and Sentry's onRequestError
  // captures it) rather than answering 500, so a failed refresh keeps serving
  // the last good cached menu instead of caching an error.
  const menu = await getMenuByUrl(url)

  if (!menu) {
    return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
  }

  return NextResponse.json(menuStreamBody(menu))
}
