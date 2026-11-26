/**
 * Retired image widths (Next's old defaults, dropped Nov 12 2026) redirect to an
 * allowed width instead of the optimizer's 400.
 */
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import nextConfig from '../../next.config.mjs'
import { IMAGE_DEVICE_SIZES, IMAGE_SIZES } from '@/lib/config/image-sizes.mjs'
import { allowedImageWidthFor, RETIRED_IMAGE_WIDTHS } from '@/lib/utils/image-width'
import { config, proxy } from '@/src/proxy'

const ALLOWED = [...IMAGE_SIZES, ...IMAGE_DEVICE_SIZES]

function imageRequest(query: string) {
  return new NextRequest(`https://lolev.beer/_next/image?${query}`)
}

describe('allowedImageWidthFor', () => {
  it('sends each retired width to the next allowed width up, or the widest', () => {
    expect(RETIRED_IMAGE_WIDTHS.map(allowedImageWidthFor)).toEqual([828, 1200, 2560, 2560])
  })

  it('leaves allowed widths alone', () => {
    for (const width of ALLOWED) expect(allowedImageWidthFor(width)).toBeNull()
  })

  it('ignores widths that are not positive whole numbers', () => {
    for (const width of [0, -750, 750.5, Number.NaN]) expect(allowedImageWidthFor(width)).toBeNull()
  })
})

describe('image width proxy', () => {
  it('redirects a retired width and keeps the rest of the query', () => {
    const response = proxy(imageRequest('url=%2Fbeer.png&w=750&q=75'))
    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/_next/image')
    expect(location.searchParams.get('w')).toBe('828')
    expect(location.searchParams.get('url')).toBe('/beer.png')
    expect(location.searchParams.get('q')).toBe('75')
    expect(response.headers.get('cache-control')).toContain('s-maxage=86400')
  })

  it('lets an allowed width through untouched', () => {
    const response = proxy(imageRequest('url=%2Fbeer.png&w=828&q=75'))
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('only runs for the retired widths', () => {
    const [rule] = config.matcher
    expect(rule.source).toBe('/_next/image')
    const matcher = new RegExp(`^${rule.has[0].value}$`)
    for (const width of RETIRED_IMAGE_WIDTHS) expect(matcher.test(String(width))).toBe(true)
    for (const width of [...ALLOWED, 7500, 75]) expect(matcher.test(String(width))).toBe(false)
  })
})

describe('next.config images', () => {
  it('allows exactly the shared widths, none of the retired ones', () => {
    expect(nextConfig.images?.deviceSizes).toEqual(IMAGE_DEVICE_SIZES)
    expect(nextConfig.images?.imageSizes).toEqual(IMAGE_SIZES)
    for (const width of RETIRED_IMAGE_WIDTHS) expect(ALLOWED).not.toContain(width)
  })
})
