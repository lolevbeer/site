/**
 * useMenuStream must keep polling when Ably is unset/disabled (Preview default).
 * A static Ably import or a realtimeFallback reschedule edge that clears timers
 * on mount would freeze /m displays with no network polls.
 */
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/utils/pittsburgh-time', () => ({ getPittsburghTheme: () => 'dark' }))

vi.mock('@/lib/ably/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ably/config')>()
  return {
    ...actual,
    isAblyClientEnabled: () => false,
  }
})

import { useMenuStream } from '@/lib/hooks/use-menu-stream'
import { FAST_INTERVAL_MS, IDLE_INTERVAL_MS, usePolling } from '@/lib/hooks/use-polling'
import type { Menu } from '@/src/payload-types'

const menu = (overrides: Partial<Menu> = {}) =>
  ({
    id: 'm1',
    url: 'draft',
    themeMode: 'light',
    type: 'draft',
    items: [],
    ...overrides,
  }) as unknown as Menu

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useMenuStream polling without Ably', () => {
  it('keeps polling the stream endpoint when Ably is disabled', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const initial = menu()
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        menu: menu({ id: 'polled' }),
        timestamp: Date.parse('2026-01-01T00:00:00Z'),
        deployId: 'd1',
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })

    const { result } = renderHook(() => useMenuStream('draft', initial))

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(fetchMock).toHaveBeenCalledWith('/api/menu-stream/draft', { cache: 'no-cache' })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(FAST_INTERVAL_MS))
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await act(() => vi.advanceTimersByTimeAsync(IDLE_INTERVAL_MS))
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result.current.menu?.id).toBe('polled')
  })
})

describe('usePolling realtimeFallback stays false', () => {
  it('keeps the warm/idle cadence when realtimeFallback never flips', async () => {
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
      { initialProps: { realtimeFallback: false } },
    )

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Spurious rerender with the same flag must not wipe the armed timer.
    await act(() => {
      rerender({ realtimeFallback: false })
    })
    await act(() => vi.advanceTimersByTimeAsync(FAST_INTERVAL_MS))
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await act(() => vi.advanceTimersByTimeAsync(IDLE_INTERVAL_MS))
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
