/**
 * Ably kiosk realtime spike: feature flags, publish no-op, auth 503 when
 * unset, and the polling realtime-fallback cadence.
 */
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('ably', () => {
  const publish = vi.fn(async () => undefined)
  const createTokenRequest = vi.fn(async () => ({ keyName: 'test', ttl: 3600000 }))
  const Rest = vi.fn(function MockRest(this: {
    channels: { get: (name: string) => { publish: typeof publish; name: string } }
    auth: { createTokenRequest: typeof createTokenRequest }
  }) {
    this.channels = {
      get: (name: string) => ({ name, publish }),
    }
    this.auth = { createTokenRequest }
  })
  return { default: { Rest }, __mock: { publish, createTokenRequest, Rest } }
})

import {
  publishKioskInvalidate,
  resetAblyRestClientForTests,
} from '@/lib/ably/publish'
import { isAblyClientEnabled, isAblyPublishEnabled } from '@/lib/ably/config'
import { ABLY_CHANNELS, ABLY_UPDATED_EVENT } from '@/lib/ably/channels'
import {
  FAST_INTERVAL_MS,
  REALTIME_FALLBACK_INTERVAL_MS,
  selectPollInterval,
  usePolling,
} from '@/lib/hooks/use-polling'
import { GET as ablyAuthGet } from '@/src/app/api/ably-auth/route'

describe('Ably feature flags', () => {
  it('treats publish as off when ABLY_API_KEY is missing or blank', () => {
    expect(isAblyPublishEnabled({})).toBe(false)
    expect(isAblyPublishEnabled({ ABLY_API_KEY: '   ' })).toBe(false)
    expect(isAblyPublishEnabled({ ABLY_API_KEY: 'app.key:secret' })).toBe(true)
  })

  it('enables the client only when NEXT_PUBLIC_ABLY_ENABLED is true', () => {
    expect(isAblyClientEnabled({})).toBe(false)
    expect(isAblyClientEnabled({ NEXT_PUBLIC_ABLY_ENABLED: 'false' })).toBe(false)
    expect(isAblyClientEnabled({ NEXT_PUBLIC_ABLY_ENABLED: 'true' })).toBe(true)
    expect(isAblyClientEnabled({ NEXT_PUBLIC_ABLY_ENABLED: 'TRUE' })).toBe(true)
  })
})

describe('publishKioskInvalidate', () => {
  const originalKey = process.env.ABLY_API_KEY

  beforeEach(() => {
    resetAblyRestClientForTests()
    delete process.env.ABLY_API_KEY
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetAblyRestClientForTests()
    if (originalKey === undefined) delete process.env.ABLY_API_KEY
    else process.env.ABLY_API_KEY = originalKey
  })

  it('no-ops when ABLY_API_KEY is unset', async () => {
    await publishKioskInvalidate({ kind: 'menu', key: 'lawrenceville-draft' })
    const ably = await import('ably')
    const mock = (ably as unknown as { __mock: { Rest: ReturnType<typeof vi.fn> } }).__mock
    expect(mock.Rest).not.toHaveBeenCalled()
  })

  it('publishes an updated message on the menu channel when configured', async () => {
    process.env.ABLY_API_KEY = 'app.key:secret'
    await publishKioskInvalidate({ kind: 'menu', key: 'lawrenceville-draft' })
    const ably = await import('ably')
    const mock = (
      ably as unknown as {
        __mock: { Rest: ReturnType<typeof vi.fn>; publish: ReturnType<typeof vi.fn> }
      }
    ).__mock
    expect(mock.Rest).toHaveBeenCalled()
    expect(mock.publish).toHaveBeenCalledWith(
      ABLY_UPDATED_EVENT,
      expect.objectContaining({
        kind: 'menu',
        key: 'lawrenceville-draft',
        at: expect.any(Number),
      }),
    )
  })

  it('publishes events invalidates on the events channel', async () => {
    process.env.ABLY_API_KEY = 'app.key:secret'
    await publishKioskInvalidate({ kind: 'events', key: 'lawrenceville' })
    const ably = await import('ably')
    const mock = (ably as unknown as { __mock: { publish: ReturnType<typeof vi.fn> } }).__mock
    expect(mock.publish).toHaveBeenCalledWith(
      ABLY_UPDATED_EVENT,
      expect.objectContaining({ kind: 'events', key: 'lawrenceville' }),
    )
  })
})

describe('/api/ably-auth', () => {
  const originalKey = process.env.ABLY_API_KEY

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ABLY_API_KEY
    else process.env.ABLY_API_KEY = originalKey
  })

  it('returns 503 when Ably is not configured', async () => {
    delete process.env.ABLY_API_KEY
    const res = await ablyAuthGet()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toMatch(/not configured/i)
  })
})

describe('selectPollInterval realtime fallback', () => {
  const state = {
    noChangeCount: 0,
    warm: true,
    consecutiveErrors: 0,
    hidden: false,
    realtimeFallback: true,
  }

  it('uses the slow safety-net interval while Ably is connected', () => {
    expect(selectPollInterval(state)).toBe(REALTIME_FALLBACK_INTERVAL_MS)
    expect(selectPollInterval({ ...state, noChangeCount: 99, warm: false })).toBe(
      REALTIME_FALLBACK_INTERVAL_MS,
    )
  })

  it('still backs off on errors and skips hidden tabs', () => {
    expect(selectPollInterval({ ...state, consecutiveErrors: 2 })).toBe(60_000)
    expect(selectPollInterval({ ...state, hidden: true })).toBeNull()
  })
})

describe('channel constants', () => {
  it('keeps the kiosk channel names stable', () => {
    expect(ABLY_CHANNELS.menu).toBe('kiosk:menu')
    expect(ABLY_CHANNELS.events).toBe('kiosk:events')
    expect(ABLY_UPDATED_EVENT).toBe('updated')
  })
})

describe('usePolling realtimeFallback reschedule', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('reschedules to warm/idle cadence when Ably disconnects instead of leaving a 120s timer', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ timestamp: Date.parse('2026-01-01T00:00:00Z') }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })

    const { rerender } = renderHook(
      ({ realtimeFallback }) =>
        usePolling<number, { timestamp: number }>(
          '/api/example',
          0,
          () => ({ data: 1, theme: 'light' }),
          { realtimeFallback },
        ),
      { initialProps: { realtimeFallback: true } },
    )

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // 100s into the 120s safety-net window: still only the first poll.
    await act(() => vi.advanceTimersByTimeAsync(100_000))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Disconnect must clear the lingering 120s timer and start warm/fast 10s.
    await act(() => {
      rerender({ realtimeFallback: false })
    })
    await act(() => vi.advanceTimersByTimeAsync(FAST_INTERVAL_MS))
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // Original 120s deadline is 20s after disconnect. A leaked timer would poll
    // here; with a proper clear, idle cadence (30s after this unchanged poll)
    // has not fired yet.
    await act(() => vi.advanceTimersByTimeAsync(19_000))
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await act(() => vi.advanceTimersByTimeAsync(11_000))
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
