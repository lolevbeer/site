import { NextRequest, NextResponse } from 'next/server'
import { getMenuByUrl } from '@/lib/utils/payload-api'
import { logger } from '@/lib/utils/logger'

/**
 * Menu polling endpoint for the /m displays.
 *
 * Cached on Vercel's CDN until the menu changes, so a display's poll almost
 * never runs this function:
 * - `force-static` with no prerendered params caches each menu URL on its
 *   first request.
 * - getMenuByUrl's cache tags (`menus`, `menu-<url>`) attach to that cached
 *   response, so the Payload hooks' `revalidateTag` calls for a menu (or a beer
 *   on it) mark it stale. The next poll gets the old copy while it refreshes;
 *   the one after gets the new menu.
 * - The 10-minute fallback refresh bounds how long a new deployment's
 *   `deployId` (which reloads displays) takes to reach them.
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

  let menu: Awaited<ReturnType<typeof getMenuByUrl>>
  try {
    menu = await getMenuByUrl(url)
  } catch (error) {
    // Throw rather than answer 500: a failed refresh keeps serving the last
    // good cached menu instead of caching an error for every display.
    logger.error('Menu fetch error:', error)
    throw error
  }

  if (!menu) {
    return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
  }

  // The newest of the menu's and its items' updatedAt, so edits to a beer or
  // product on the menu count as changes even if the menu document didn't.
  let timestamp = menu.updatedAt ? new Date(menu.updatedAt).getTime() : 0
  for (const item of menu.items ?? []) {
    const product = item.product?.value
    if (product && typeof product === 'object' && 'updatedAt' in product) {
      timestamp = Math.max(timestamp, new Date(product.updatedAt as string).getTime())
    }
  }

  return NextResponse.json({
    menu,
    timestamp,
    deployId: process.env.NEXT_PUBLIC_DEPLOY_ID || '',
  })
}
