/**
 * next.config.mjs header and redirect rules: Payload's color-scheme client
 * hints stay on the admin (Critical-CH makes Chromium retry every public
 * first navigation), and legacy /api/media/file URLs go to the Blob CDN.
 */
import { afterEach, describe, expect, it } from 'vitest'
import nextConfig, { scopeClientHints } from '../../next.config.mjs'

type Rule = { source: string; headers: { key: string; value: string }[] }

const HINT_KEYS = ['Accept-CH', 'Vary', 'Critical-CH']

function rulesWithKey(rules: Rule[], key: string) {
  return rules.filter((rule) => rule.headers.some((h) => h.key === key))
}

describe('scopeClientHints', () => {
  const payloadRule: Rule = {
    source: '/:path*',
    headers: [
      { key: 'Accept-CH', value: 'Sec-CH-Prefers-Color-Scheme' },
      { key: 'Vary', value: 'Sec-CH-Prefers-Color-Scheme' },
      { key: 'Critical-CH', value: 'Sec-CH-Prefers-Color-Scheme' },
      { key: 'X-Powered-By', value: 'Next.js, Payload' },
    ],
  }

  it('moves only the color-scheme hints to /admin/:path*', () => {
    const rules = scopeClientHints([payloadRule]) as Rule[]
    for (const key of HINT_KEYS) {
      expect(rulesWithKey(rules, key).map((r) => r.source)).toEqual(['/admin/:path*'])
    }
    expect(rulesWithKey(rules, 'X-Powered-By').map((r) => r.source)).toEqual(['/:path*'])
  })

  it('leaves unrelated rules untouched', () => {
    const other: Rule = { source: '/x', headers: [{ key: 'Cache-Control', value: 'no-store' }] }
    expect(scopeClientHints([other])).toEqual([other])
  })

  it('applies to the exported config headers', async () => {
    const rules = (await nextConfig.headers!()) as Rule[]
    expect(rulesWithKey(rules, 'Critical-CH').map((r) => r.source)).toEqual(['/admin/:path*'])
    expect(rules.some((r) => r.source === '/api/media/file/:path*')).toBe(false)
  })
})

describe('legacy media redirect', () => {
  const original = process.env.BLOB_READ_WRITE_TOKEN
  afterEach(() => {
    if (original === undefined) delete process.env.BLOB_READ_WRITE_TOKEN
    else process.env.BLOB_READ_WRITE_TOKEN = original
  })

  it('sends /api/media/file to the Blob store named in the token', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_AbC123_secretpart'
    const redirects = await nextConfig.redirects!()
    expect(redirects).toContainEqual({
      source: '/api/media/file/:path*',
      destination: 'https://abc123.public.blob.vercel-storage.com/:path*',
      permanent: false,
    })
  })

  it('leaves /api/media/file to Payload when Blob is off (local dev)', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN
    const redirects = await nextConfig.redirects!()
    expect(redirects.some((r) => r.source === '/api/media/file/:path*')).toBe(false)
  })
})
