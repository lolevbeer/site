/**
 * Client side of the /m and /e display polling (see the "Polling state
 * machine" in docs/superpowers/specs/2026-09-01-vercel-efficiency-design.md):
 * 10s right after a change or while content is recent ("warm"), 30s when idle,
 * 30/60/120s backoff on errors, no polling in hidden tabs. Polls revalidate
 * with the CDN so unchanged ones can be 304s, and each display works out its
 * own day/night theme (the endpoints send no clock-dependent fields, so their
 * responses stay cacheable until content changes).
 */
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/utils/pittsburgh-time', () => ({ getPittsburghTheme: () => 'dark' }))

import { selectPollInterval, usePolling } from '@/lib/hooks/use-polling'
import { useClockBucket } from '@/lib/hooks/use-clock-bucket'
import { useMenuStream } from '@/lib/hooks/use-menu-stream'
import { useEventsStream } from '@/lib/hooks/use-events-stream'
import type { Menu } from '@/src/payload-types'

function stubFetch(body: () => unknown) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => body() }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

const pollExample = () =>
  renderHook(() =>
    usePolling<number, { timestamp: number }>('/api/example', 0, () => ({
      data: 1,
      theme: 'light',
    })),
  )

beforeEach(() => {
  vi.unstubAllGlobals()
  setHidden(false)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('selectPollInterval', () => {
  const state = { noChangeCount: 1, warm: false, consecutiveErrors: 0, hidden: false }

  it('polls every 10s after a change or while content is recent, else every 30s', () => {
    expect(selectPollInterval({ ...state, noChangeCount: 0 })).toBe(10_000)
    expect(selectPollInterval({ ...state, warm: true })).toBe(10_000)
    expect(selectPollInterval(state)).toBe(30_000)
    expect(selectPollInterval({ ...state, noChangeCount: 500 })).toBe(30_000)
  })

  it('backs off 30s, 60s, then 120s on consecutive errors', () => {
    expect(selectPollInterval({ ...state, consecutiveErrors: 1 })).toBe(30_000)
    expect(selectPollInterval({ ...state, consecutiveErrors: 2 })).toBe(60_000)
    expect(selectPollInterval({ ...state, consecutiveErrors: 3 })).toBe(120_000)
    expect(selectPollInterval({ ...state, consecutiveErrors: 9 })).toBe(120_000)
  })

  it('schedules nothing while the tab is hidden', () => {
    expect(selectPollInterval({ ...state, hidden: true })).toBeNull()
  })
})

describe('usePolling', () => {
  it('revalidates with the CDN instead of bypassing the HTTP cache, so unchanged polls can be 304s', async () => {
    const fetchMock = stubFetch(() => ({ timestamp: 1 }))
    pollExample()

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith('/api/example', { cache: 'no-cache' })
  })

  it('polls again after 10s, then every 30s once content is unchanged and older than a minute', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const fetchMock = stubFetch(() => ({ timestamp: Date.parse('2026-01-01T00:00:00Z') }))
    pollExample()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(29_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('keeps polling every 10s while the content changed within the last minute', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const editedAt = Date.now()
    const fetchMock = stubFetch(() => ({ timestamp: editedAt }))
    pollExample()
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(20_000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not re-render the display when a poll finds nothing new', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    stubFetch(() => ({ timestamp: 1 }))
    let renders = 0
    renderHook(() => {
      renders += 1
      return usePolling<number, { timestamp: number }>('/api/example', 0, () => ({
        data: 1,
        theme: 'light',
      }))
    })
    // One act() per step, so each step's renders are flushed before counting.
    // React may render once more on the first same-value update after a real
    // change; the second poll absorbs that before the count is taken.
    await act(() => vi.advanceTimersByTimeAsync(0)) // first poll: new data
    await act(() => vi.advanceTimersByTimeAsync(10_000)) // second poll: unchanged
    const settled = renders

    await act(() => vi.advanceTimersByTimeAsync(60_000)) // two more unchanged polls
    expect(renders).toBe(settled)
  })

  it('stops polling while the tab is hidden and polls at once when it is shown again', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const fetchMock = stubFetch(() => ({ timestamp: 1 }))
    pollExample()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    act(() => setHidden(true))
    await vi.advanceTimersByTimeAsync(300_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    act(() => setHidden(false))
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the display up until a new deploy renders the page, then reloads', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const reload = vi.fn()
    vi.stubGlobal('location', { href: 'http://localhost/m/example', reload })
    let deployId = 'old'
    // A cold deploy serves the black error screen with status 200.
    let page = { ok: true, html: '<div style="background:#000"></div>' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/example'
          ? { ok: true, json: async () => ({ timestamp: 1, deployId }) }
          : { ok: page.ok, text: async () => page.html },
      ),
    )
    pollExample()
    await vi.advanceTimersByTimeAsync(0)

    deployId = 'new'
    await vi.advanceTimersByTimeAsync(10_000)
    expect(reload).not.toHaveBeenCalled()

    page = { ok: false, html: '' } // still failing outright
    await vi.advanceTimersByTimeAsync(30_000) // first error backoff
    expect(reload).not.toHaveBeenCalled()

    page = { ok: true, html: '<meta name="live-display" content="ready"/>' } // warmed up
    await vi.advanceTimersByTimeAsync(60_000) // second error backoff
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('useClockBucket', () => {
  it('advances once per period of wall-clock time, however often anything polls', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.setSystemTime(Date.parse('2026-01-01T00:00:10Z'))
    const start = Math.floor(Date.now() / 30_000)
    const { result } = renderHook(() => useClockBucket(30_000))
    expect(result.current).toBe(start)

    act(() => vi.advanceTimersByTime(20_000))
    expect(result.current).toBe(start + 1)
    act(() => vi.advanceTimersByTime(30_000))
    expect(result.current).toBe(start + 2)
  })

  it('is null in server HTML, so the first client render always matches it', () => {
    const Bucket = () => String(useClockBucket(30_000))
    expect(renderToString(createElement(Bucket))).toBe('null')
  })
})

describe('display themes', () => {
  const menu = (themeMode: Menu['themeMode']) =>
    ({ id: 'm1', url: 'draft', themeMode, items: [] }) as unknown as Menu

  it("uses a menu's fixed theme when it has one", async () => {
    const initial = menu('light')
    const polled = menu('light')
    stubFetch(() => ({ menu: polled, timestamp: 2, deployId: '' }))
    const { result } = renderHook(() => useMenuStream('draft', initial))

    // The theme lands in the same render as the polled menu.
    await waitFor(() => expect(result.current.menu).toBe(polled))
    expect(result.current.theme).toBe('light')
  })

  it('works out the Pittsburgh day/night theme for auto menus and for events', async () => {
    // Themes start 'light'; the mocked Pittsburgh clock says 'dark'.
    stubFetch(() => ({ menu: menu('auto'), timestamp: 2, deployId: '' }))
    const menuHook = renderHook(() => useMenuStream('draft', menu('auto')))
    await waitFor(() => expect(menuHook.result.current.theme).toBe('dark'))

    stubFetch(() => ({ events: [], locationName: 'Lawrenceville', timestamp: 0, deployId: '' }))
    const eventsHook = renderHook(() => useEventsStream('lawrenceville', [], 'Lawrenceville'))
    await waitFor(() => expect(eventsHook.result.current.theme).toBe('dark'))
  })
})
