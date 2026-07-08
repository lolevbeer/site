/**
 * Regression test: ISR data fetchers must NOT swallow transient DB errors.
 *
 * Bug: every fetcher in lib/utils/payload-api.ts caught errors and returned an
 * empty default ([], null, {}). During an ISR render (common right after a
 * Vercel deploy, when cold lambdas hit a connection storm) that empty result
 * gets baked into the full-route cache and served for the whole revalidate
 * window — /beer empty for an hour, the homepage carousel/events empty for
 * 5 minutes. A thrown error is never persisted to the route cache, so it
 * self-heals on the next request (same fix already applied to /m displays,
 * commit 7160f57e).
 *
 * These tests assert the fetchers REJECT on a transient failure and still
 * return real data on success.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// unstable_cache just runs the wrapped fn in this unit context.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
}))

// Silence expected error logging.
vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const find = vi.fn()
const findGlobal = vi.fn()
vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ find, findGlobal })),
}))
vi.mock('@/src/payload.config', () => ({ default: {} }))

import {
  getAllBeersFromPayload,
  getAllLocations,
  getAvailableBeersFromMenus,
  getUpcomingEventsFromPayload,
  getComingSoonBeers,
} from '@/lib/utils/payload-api'

const TRANSIENT = new Error('ECONNREFUSED: transient DB failure')

beforeEach(() => {
  find.mockReset()
  findGlobal.mockReset()
})

describe('ISR fetchers propagate transient errors (do not cache empty)', () => {
  it('getAllBeersFromPayload rejects instead of returning []', async () => {
    find.mockRejectedValue(TRANSIENT)
    await expect(getAllBeersFromPayload()).rejects.toThrow(/transient/)
  })

  it('getAllLocations rejects (cascade root — empty here empties the whole homepage)', async () => {
    find.mockRejectedValue(TRANSIENT)
    await expect(getAllLocations()).rejects.toThrow(/transient/)
  })

  it('getAvailableBeersFromMenus rejects instead of returning []', async () => {
    find.mockRejectedValue(TRANSIENT)
    await expect(getAvailableBeersFromMenus()).rejects.toThrow(/transient/)
  })

  it('getUpcomingEventsFromPayload rejects instead of returning []', async () => {
    find.mockRejectedValue(TRANSIENT)
    await expect(getUpcomingEventsFromPayload('lawrenceville')).rejects.toThrow(/transient/)
  })

  it('getComingSoonBeers rejects instead of returning []', async () => {
    findGlobal.mockRejectedValue(TRANSIENT)
    await expect(getComingSoonBeers()).rejects.toThrow(/transient/)
  })
})

describe('ISR fetchers still return data on success', () => {
  it('getAllBeersFromPayload returns docs', async () => {
    find.mockResolvedValue({ docs: [{ id: '1', name: 'Test IPA' }] })
    await expect(getAllBeersFromPayload()).resolves.toEqual([{ id: '1', name: 'Test IPA' }])
  })
})
