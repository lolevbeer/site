/**
 * vercel.json redirects never chain (a destination is never itself a
 * redirect source) and never shadow a taproom slug.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RESERVED_LOCATION_SLUGS } from '@/lib/config/locations'

type Redirect = { source: string; destination: string; permanent?: boolean; has?: unknown[] }

const { redirects } = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
  redirects: Redirect[]
}

describe('vercel.json redirects', () => {
  // A taproom slug equal to a top-level redirect source would be unreachable.
  it('reserves every single-segment redirect source as a location slug', () => {
    const singleSegment = redirects
      .map((r) => r.source.match(/^\/([a-z0-9-]+)$/)?.[1])
      .filter((slug): slug is string => !!slug)
    expect(singleSegment.filter((slug) => !RESERVED_LOCATION_SLUGS.has(slug))).toEqual([])
  })

  it('has no redirect chains', () => {
    const sources = new Set(redirects.filter((r) => !r.has).map((r) => r.source))
    const chained = redirects.filter((r) => sources.has(r.destination))
    expect(chained).toEqual([])
  })
})
