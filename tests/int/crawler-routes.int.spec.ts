/**
 * The machine-read text routes froze at their last deploy as ISR route handlers
 * (revalidate = 3600), so they render on request behind the CDN instead. See
 * lib/seo/crawler-route.ts.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { crawlerCacheControl } from '@/lib/seo/crawler-route'

const ROUTES = ['src/app/sitemap.xml/route.ts', 'src/app/llms-full.txt/route.ts']

describe('crawler routes', () => {
  it.each(ROUTES)('%s renders on request and sends the CDN lifetime', (file) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8')
    expect(source).toMatch(/export const dynamic = 'force-dynamic'/)
    expect(source).not.toMatch(/export const revalidate/)
    expect(source).toContain('crawlerCacheControl(complete)')
  })

  it('lets the CDN keep a complete copy for an hour, never a stale one', () => {
    expect(crawlerCacheControl(true)).toContain('s-maxage=3600')
    expect(crawlerCacheControl(true)).not.toContain('stale-while-revalidate')
  })

  it('keeps a copy with a failed read out of the cache', () => {
    expect(crawlerCacheControl(false)).toBe('no-store')
  })
})
