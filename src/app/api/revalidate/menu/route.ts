import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/utils/cache'

/**
 * Revalidation endpoint for menu cache
 * Called by Payload's afterChange hook when a menu is updated
 *
 * This invalidates the cached menu data so the next request gets fresh data.
 * Much more efficient than constant polling - only revalidates on actual changes.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the request is from our Payload instance
    const authHeader = request.headers.get('x-revalidate-token')
    const expectedToken = process.env.REVALIDATE_SECRET

    if (expectedToken && authHeader !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { menuUrl } = body

    // Revalidate the menus cache tag
    revalidateTag(CACHE_TAGS.menus)

    // Also revalidate specific menu path if provided
    if (menuUrl) {
      revalidateTag(`menu-${menuUrl}`)
    }

    return NextResponse.json({
      revalidated: true,
      menuUrl,
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Revalidation error:', error)
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 })
  }
}
