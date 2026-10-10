/**
 * Legacy and guessed URLs in vercel.json redirect permanently to real pages,
 * with no chains (a destination is never itself a redirect source).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

type Redirect = { source: string; destination: string; permanent?: boolean; has?: unknown[] }

const { redirects } = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
  redirects: Redirect[]
}

const EXPECTED: Record<string, string> = {
  '/careers': '/jobs',
  '/calendar': '/events',
  '/upcoming': '/events',
  '/shows': '/events',
  '/performances': '/events',
  '/lawrenceville': '/lolev-lawrenceville',
  '/zelienople': '/lolev-zelienople',
  '/menu': '/beer',
  '/on-tap': '/beer',
  '/tap-list': '/beer',
  '/hours': '/',
  '/shop': '/beer-map',
  '/favicon.ico': '/favicons/favicon-32x32.png',
  '/apple-touch-icon.png': '/favicons/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png': '/favicons/apple-touch-icon.png',
}

describe('vercel.json redirects', () => {
  it.each(Object.entries(EXPECTED))('%s permanently redirects to %s', (source, destination) => {
    expect(redirects).toContainEqual({ source, destination, permanent: true })
  })

  it('has no redirect chains', () => {
    const sources = new Set(redirects.filter((r) => !r.has).map((r) => r.source))
    const chained = redirects.filter((r) => sources.has(r.destination))
    expect(chained).toEqual([])
  })
})
