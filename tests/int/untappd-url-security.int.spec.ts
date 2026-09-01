/** Untappd URL validation and bounded fetch behavior prevent authenticated SSRF. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.fn()
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@/src/payload.config', () => ({ default: {} }))
vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { getPayload } from 'payload'
import { NextRequest } from 'next/server'
import { GET } from '@/src/app/api/untappd/route'
import * as untappd from '@/src/utils/untappd'
import {
  fetchUntappdData,
  normalizeUntappdBeerUrl,
  UNTAPPD_MAX_BODY_BYTES,
} from '@/src/utils/untappd'

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.mocked(getPayload).mockResolvedValue({ auth } as never)
  auth.mockResolvedValue({ user: { id: 'admin' } })
})

describe('normalizeUntappdBeerUrl', () => {
  it.each([
    ['/b/lolev-beer-lupula/123456', 'https://untappd.com/b/lolev-beer-lupula/123456'],
    ['https://untappd.com/b/lolev-beer-lupula/123456?source=test#reviews', 'https://untappd.com/b/lolev-beer-lupula/123456'],
    ['https://www.untappd.com/b/lolev-beer-lupula/123456', 'https://untappd.com/b/lolev-beer-lupula/123456'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeUntappdBeerUrl(input)?.toString()).toBe(expected)
  })

  it.each([
    'http://untappd.com/b/beer/1',
    'https://untappd.com:444/b/beer/1',
    'https://user:pass@untappd.com/b/beer/1',
    'https://untappd.com.evil.example/b/beer/1',
    'https://127.0.0.1/b/beer/1',
    'http://169.254.169.254/latest/meta-data',
    'https://untappd.com/search?q=lolev',
    '/b/not-enough-segments',
    'not a url',
  ])('rejects %s', (input) => {
    expect(normalizeUntappdBeerUrl(input)).toBeNull()
  })
})

describe('fetchUntappdData network boundary', () => {
  it('does not fetch an invalid destination', async () => {
    global.fetch = vi.fn()
    await expect(fetchUntappdData('http://169.254.169.254/latest/meta-data')).resolves.toMatchObject({
      failure: 'permanent',
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('uses the canonical URL and disables redirects', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('', { status: 302 }))
    await expect(fetchUntappdData('/b/lolev-beer-lupula/123456')).resolves.toMatchObject({
      failure: 'permanent',
    })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://untappd.com/b/lolev-beer-lupula/123456',
      expect.objectContaining({ redirect: 'manual', signal: expect.any(AbortSignal) }),
    )
  })

  it('rejects a declared oversized response', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('small', {
        status: 200,
        headers: { 'content-length': String(UNTAPPD_MAX_BODY_BYTES + 1) },
      }),
    )
    await expect(fetchUntappdData('/b/lolev-beer-lupula/123456')).resolves.toMatchObject({
      failure: 'permanent',
    })
  })
})

describe('GET /api/untappd rating', () => {
  it('rejects an invalid URL before calling the fetch helper', async () => {
    const fetchUntappdDataSpy = vi.spyOn(untappd, 'fetchUntappdData')

    const response = await GET(
      new NextRequest('http://localhost/api/untappd?action=rating&url=http%3A%2F%2F169.254.169.254%2Flatest%2Fmeta-data'),
    )

    expect(response.status).toBe(400)
    expect(fetchUntappdDataSpy).not.toHaveBeenCalled()
  })
})
