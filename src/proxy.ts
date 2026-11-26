import { NextResponse, type NextRequest } from 'next/server'
import { allowedImageWidthFor } from '@/lib/utils/image-width'

/**
 * Sends image requests for retired widths to an allowed one instead of the
 * optimizer's 400. Vercel logged about 1,100 of those a week after the width
 * list shrank on Nov 12 2026, half from lolev.beer pages and many from bingbot.
 * The matcher keeps every other request away from this function.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone()
  const width = allowedImageWidthFor(Number(url.searchParams.get('w')))
  if (width === null) return NextResponse.next()

  url.searchParams.set('w', String(width))
  // 307 and a day's cache: cheap to repeat, and nothing pins the target if the
  // width list changes again.
  const response = NextResponse.redirect(url, 307)
  response.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400')
  return response
}

export const config = {
  matcher: [
    {
      // Must stay a literal for build-time analysis; mirrors RETIRED_IMAGE_WIDTHS.
      source: '/_next/image',
      has: [{ type: 'query', key: 'w', value: '(750|1080|2048|3840)' }],
    },
  ],
}
