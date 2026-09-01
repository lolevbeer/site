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
  isCircuitOpen,
  normalizeUntappdBeerUrl,
  resetCircuit,
  UNTAPPD_FETCH_TIMEOUT_MS,
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
    ['https://WWW.Untappd.com/b/lolev-beer-lupula/123456', 'https://untappd.com/b/lolev-beer-lupula/123456'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeUntappdBeerUrl(input)?.toString()).toBe(expected)
  })

  it.each([
    'http://untappd.com/b/beer/1',
    'https://untappd.com:444/b/beer/1',
    'https://untappd.com:443/b/beer/1',
    'https://untappd.com:0443/b/beer/1',
    'https://user:pass@untappd.com/b/beer/1',
    'https://untappd.com.evil.example/b/beer/1',
    'https://127.0.0.1/b/beer/1',
    'http://169.254.169.254/latest/meta-data',
    'https://untappd.com/search?q=lolev',
    '//untappd.com/b/beer/1',
    '/B/beer/1',
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

  it('uses the canonical URL, disables redirects, and cancels redirect bodies', async () => {
    const cancel = vi.fn()
    global.fetch = vi.fn().mockResolvedValue(
      new Response(new ReadableStream({ cancel }), { status: 302 }),
    )
    await expect(fetchUntappdData('/b/lolev-beer-lupula/123456')).resolves.toMatchObject({
      failure: 'permanent',
    })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://untappd.com/b/lolev-beer-lupula/123456',
      expect.objectContaining({ redirect: 'manual', signal: expect.any(AbortSignal) }),
    )
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('rejects declared oversized responses and cancels their bodies', async () => {
    const cancel = vi.fn()
    global.fetch = vi.fn().mockResolvedValue(
      new Response(new ReadableStream({ cancel }), {
        status: 200,
        headers: { 'content-length': String(UNTAPPD_MAX_BODY_BYTES + 1) },
      }),
    )
    await expect(fetchUntappdData('/b/lolev-beer-lupula/123456')).resolves.toMatchObject({
      failure: 'permanent',
    })
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('classifies an over-limit unknown-length stream as permanent when reader cancellation rejects', async () => {
    const cancel = vi.fn().mockRejectedValue(new Error('stream cancellation failed'))
    const overflowChunk = new Uint8Array(UNTAPPD_MAX_BODY_BYTES + 1)
    global.fetch = vi.fn().mockImplementation(
      () =>
        Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(overflowChunk)
              },
              cancel,
            }),
          ),
        ),
    )

    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(fetchUntappdData('/b/lolev-beer-lupula/123456')).resolves.toMatchObject({
        failure: 'permanent',
      })
    }

    expect(cancel).toHaveBeenCalledTimes(5)
    expect(isCircuitOpen()).toBe(false)
    resetCircuit()
  })

  it('uses the exact timeout and classifies an aborted request as retryable', async () => {
    const controller = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)
    global.fetch = vi.fn().mockRejectedValue(new DOMException('Timed out', 'TimeoutError'))

    await expect(fetchUntappdData('/b/lolev-beer-lupula/123456')).resolves.toMatchObject({
      failure: 'retryable',
    })

    expect(timeout).toHaveBeenCalledWith(UNTAPPD_FETCH_TIMEOUT_MS)
    resetCircuit()
  })
})

describe('GET /api/untappd rating', () => {
  it.each([
    'http://169.254.169.254/latest/meta-data',
    'https://untappd.com:443/b/beer/1',
    'https://untappd.com:0443/b/beer/1',
    '//untappd.com/b/beer/1',
  ])('rejects %s before calling the fetch helper', async (url) => {
    global.fetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }))
    const fetchUntappdDataSpy = vi.spyOn(untappd, 'fetchUntappdData')

    const response = await GET(
      new NextRequest(`http://localhost/api/untappd?action=rating&url=${encodeURIComponent(url)}`),
    )

    expect(response.status).toBe(400)
    expect(fetchUntappdDataSpy).not.toHaveBeenCalled()
  })
})
