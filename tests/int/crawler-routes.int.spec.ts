/**
 * The machine-read text routes froze at their last deploy as ISR route handlers
 * (revalidate = 3600), so they render on request behind the CDN instead. See
 * lib/seo/crawler-route.ts.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CRAWLER_ROUTE_CACHE_CONTROL } from '@/lib/seo/crawler-route'

const ROUTES = ['src/app/sitemap.xml/route.ts', 'src/app/llms-full.txt/route.ts']

describe('crawler routes', () => {
  it.each(ROUTES)('%s renders on request and sends the CDN lifetime', (file) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8')
    expect(source).toMatch(/export const dynamic = 'force-dynamic'/)
    expect(source).not.toMatch(/export const revalidate/)
    expect(source).toContain('CRAWLER_ROUTE_CACHE_CONTROL')
  })

  it('lets the CDN keep a copy for an hour and serve it while refreshing', () => {
    expect(CRAWLER_ROUTE_CACHE_CONTROL).toContain('s-maxage=3600')
    expect(CRAWLER_ROUTE_CACHE_CONTROL).toContain('stale-while-revalidate=')
  })
})
