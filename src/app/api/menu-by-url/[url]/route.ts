import { NextRequest, NextResponse } from 'next/server'
import { getMenuByUrl, hasAnyBeerJustReleased } from '@/lib/utils/payload-api'
import crypto from 'crypto'

/**
 * Generate ETag from menu data
 * Uses a hash of the updatedAt timestamp and item count for efficiency
 */
function generateETag(menu: { updatedAt?: string; items?: unknown[] }): string {
  const content = `${menu.updatedAt || ''}-${menu.items?.length || 0}`
  return `"${crypto.createHash('md5').update(content).digest('hex').slice(0, 16)}"`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ url: string }> }
) {
  try {
    const { url } = await params
    const [menu, hasGlobalJustReleased] = await Promise.all([
      getMenuByUrl(url),
      hasAnyBeerJustReleased(),
    ])

    if (!menu) {
      return NextResponse.json(
        { error: 'Menu not found' },
        { status: 404 }
      )
    }

    // Add global just released flag to menu response
    const menuWithFlag = { ...menu, _hasGlobalJustReleased: hasGlobalJustReleased }

    // Generate ETag from menu content
    const etag = generateETag(menu)

    // Check If-None-Match header for conditional request
    const ifNoneMatch = request.headers.get('If-None-Match')
    if (ifNoneMatch === etag) {
      // Content hasn't changed - return 304 Not Modified (minimal bandwidth)
      return new NextResponse(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'private, no-cache, must-revalidate',
        },
      })
    }

    // Return full response with ETag
    return NextResponse.json(menuWithFlag, {
      headers: {
        'ETag': etag,
        'Cache-Control': 'private, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Error fetching menu:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
