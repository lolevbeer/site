/**
 * Ably kiosk realtime spike: feature flags, publish no-op, auth 503 when
 * unset, and the polling realtime-fallback cadence.
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const after = vi.hoisted(() => vi.fn<(_task: () => Promise<void>) => void>())
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after,
}))

const ablyMock = vi.hoisted(() => {
  const publish = vi.fn(async () => undefined)
  const createTokenRequest = vi.fn(async () => ({ keyName: 'test', ttl: 3600000 }))
  const subscribe = vi.fn(
    (_event: string, _listener: (message: { data: unknown }) => void) => undefined,
  )
  const unsubscribe = vi.fn()
  const getChannel = vi.fn((_name: string) => ({ publish, subscribe, unsubscribe }))
  const connection = {
    on: vi.fn((_event: string, _listener: () => void) => undefined),
    off: vi.fn(),
  }
  const close = vi.fn()
  const Rest = vi.fn(function MockRest() {
    return { channels: { get: getChannel }, auth: { createTokenRequest } }
  })
  const Realtime = vi.fn(function MockRealtime() {
    return { channels: { get: getChannel }, connection, close }
  })
  return { publish, Rest, Realtime, getChannel, subscribe, unsubscribe, connection, close }
})
vi.mock('ably', () => ({ default: ablyMock }))

import { publishKioskInvalidate, resetAblyRestClientForTests } from '@/lib/ably/publish'
import { isAblyClientEnabled, isAblyPublishEnabled } from '@/lib/ably/config'
import { ABLY_CHANNELS, ABLY_UPDATED_EVENT } from '@/lib/ably/channels'
import {
  FAST_INTERVAL_MS,
  REALTIME_FALLBACK_INTERVAL_MS,
  selectPollInterval,
  usePolling,
} from '@/lib/hooks/use-polling'
import { GET as ablyAuthGet } from '@/src/app/api/ably-auth/route'
import { useAblyInvalidate } from '@/lib/hooks/use-ably-invalidate'
import { useMenuStream } from '@/lib/hooks/use-menu-stream'
import type { Menu } from '@/src/payload-types'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

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

  it('reads process.env.NEXT_PUBLIC_ABLY_ENABLED directly when called with no args', () => {
    vi.stubEnv('NEXT_PUBLIC_ABLY_ENABLED', undefined)
    expect(isAblyClientEnabled()).toBe(false)
    vi.stubEnv('NEXT_PUBLIC_ABLY_ENABLED', 'true')
    expect(isAblyClientEnabled()).toBe(true)
    vi.stubEnv('NEXT_PUBLIC_ABLY_ENABLED', 'false')
    expect(isAblyClientEnabled()).toBe(false)
  })
})

describe('publishKioskInvalidate', () => {
  beforeEach(() => {
    resetAblyRestClientForTests()
    vi.stubEnv('ABLY_API_KEY', undefined)
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetAblyRestClientForTests()
  })

  it('no-ops when ABLY_API_KEY is unset', async () => {
    await publishKioskInvalidate({ kind: 'menu', key: 'lawrenceville-draft' })
    expect(ablyMock.Rest).not.toHaveBeenCalled()
    expect(after).not.toHaveBeenCalled()
  })

  it('publishes only after the save response, when the transaction and cache invalidation are done', async () => {
    vi.stubEnv('ABLY_API_KEY', 'app.key:secret')
    await publishKioskInvalidate({ kind: 'menu', key: 'lawrenceville-draft' })
    expect(ablyMock.publish).not.toHaveBeenCalled()
    expect(after).toHaveBeenCalledTimes(1)
    await after.mock.calls[0][0]()
    expect(ablyMock.Rest).toHaveBeenCalled()
    expect(ablyMock.getChannel).toHaveBeenCalledWith(ABLY_CHANNELS.menu)
    expect(ablyMock.publish).toHaveBeenCalledWith(
      ABLY_UPDATED_EVENT,
      expect.objectContaining({
        kind: 'menu',
        key: 'lawrenceville-draft',
        at: expect.any(Number),
      }),
    )
  })

  it('publishes events invalidates on the events channel', async () => {
    vi.stubEnv('ABLY_API_KEY', 'app.key:secret')
    await publishKioskInvalidate({ kind: 'events', key: 'lawrenceville' })
    await after.mock.calls[0][0]()
    expect(ablyMock.getChannel).toHaveBeenCalledWith(ABLY_CHANNELS.events)
    expect(ablyMock.publish).toHaveBeenCalledWith(
      ABLY_UPDATED_EVENT,
      expect.objectContaining({ kind: 'events', key: 'lawrenceville' }),
    )
  })

  it('handles a failed background publish without rejecting the save or after task', async () => {
    vi.stubEnv('ABLY_API_KEY', 'app.key:secret')
    ablyMock.publish.mockRejectedValueOnce(new Error('Ably unavailable'))
    await expect(publishKioskInvalidate({ kind: 'menu', key: 'draft' })).resolves.toBeUndefined()
    await expect(after.mock.calls[0][0]()).resolves.toBeUndefined()
  })
})

describe('/api/ably-auth', () => {
  it('returns 503 when Ably is not configured', async () => {
    vi.stubEnv('ABLY_API_KEY', undefined)
    const res = await ablyAuthGet()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toMatch(/not configured/i)
  })
})

describe('useAblyInvalidate', () => {
  it('filters messages and reconnects with the new channel and key when props change', async () => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_ABLY_ENABLED', 'true')
    const { result, rerender, unmount } = renderHook(useAblyInvalidate, {
      initialProps: { kind: 'menu' as 'menu' | 'events', key: 'draft' },
    })
    await waitFor(() => expect(ablyMock.subscribe).toHaveBeenCalledTimes(1))
    expect(ablyMock.getChannel).toHaveBeenLastCalledWith(ABLY_CHANNELS.menu)
    const onMenu = ablyMock.subscribe.mock.calls[0][1]
    const onConnected = ablyMock.connection.on.mock.calls.find(
      ([event]) => event === 'connected',
    )![1]
    act(() => {
      onConnected()
      onMenu({ data: { kind: 'menu', key: 'other' } })
      onMenu({ data: { kind: 'events', key: 'draft' } })
      onMenu({ data: null })
    })
    expect(result.current).toEqual({ invalidateSignal: 0, realtimeActive: true })
    act(() => {
      onMenu({ data: { kind: 'menu', key: 'draft' } })
      onMenu({ data: { kind: 'menu' } })
    })
    expect(result.current.invalidateSignal).toBe(2)

    rerender({ kind: 'events', key: 'lawrenceville' })
    await waitFor(() => expect(ablyMock.subscribe).toHaveBeenCalledTimes(2))
    expect(ablyMock.getChannel).toHaveBeenLastCalledWith(ABLY_CHANNELS.events)
    expect(ablyMock.unsubscribe).toHaveBeenCalledWith(ABLY_UPDATED_EVENT, onMenu)
    expect(ablyMock.close).toHaveBeenCalledTimes(1)
    const onEvents = ablyMock.subscribe.mock.calls[1][1]
    act(() => {
      onMenu({ data: { kind: 'menu', key: 'draft' } })
      onEvents({ data: { kind: 'events', key: 'lawrenceville' } })
    })
    expect(result.current).toEqual({ invalidateSignal: 3, realtimeActive: false })
    unmount()
    expect(ablyMock.close).toHaveBeenCalledTimes(2)
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

describe('useMenuStream when publishing fails', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    resetAblyRestClientForTests()
  })

  it('applies saved changes on the safety poll even while Ably stays connected without messages', async () => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.stubEnv('NEXT_PUBLIC_ABLY_ENABLED', 'true')
    vi.stubEnv('ABLY_API_KEY', 'app.key:secret')
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })

    const initial: Menu = {
      id: 'menu-1',
      url: 'z-cans',
      type: 'cans',
      themeMode: 'light',
      items: [],
      location: 'location-1',
      createdAt: '2026-01-01T00:00:00Z',
      name: 'Before save',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    let saved = initial
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ menu: saved, timestamp: Date.parse(saved.updatedAt) }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useMenuStream('z-cans', initial))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(ablyMock.subscribe).toHaveBeenCalledTimes(1)
    const onConnected = ablyMock.connection.on.mock.calls.find(
      ([event]) => event === 'connected',
    )![1]
    act(onConnected)

    // The write succeeds, but the server cannot notify the still-connected display.
    saved = { ...initial, name: 'After save', updatedAt: '2026-01-01T00:01:00Z' }
    ablyMock.publish.mockRejectedValueOnce(new Error('Unauthorized to publish to channel'))
    await publishKioskInvalidate({ kind: 'menu', key: 'z-cans' })
    await after.mock.calls[0][0]()

    await act(() => vi.advanceTimersByTimeAsync(REALTIME_FALLBACK_INTERVAL_MS - 1))
    expect(result.current.menu?.name).toBe('Before save')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(result.current.menu?.name).toBe('After save')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // A second edit also arrives without a single Ably message or disconnect.
    saved = { ...saved, name: 'Another save', updatedAt: '2026-01-01T00:02:00Z' }
    await act(() => vi.advanceTimersByTimeAsync(REALTIME_FALLBACK_INTERVAL_MS))
    expect(result.current.menu?.name).toBe('Another save')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
