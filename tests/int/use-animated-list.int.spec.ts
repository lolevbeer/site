/**
 * Tests for useAnimatedList — the enter/exit animation hook behind the live
 * menu displays. Regression coverage: in-place item content changes (e.g. a
 * beer's hops edited in the CMS) must reach the rendered list even when the
 * item keys are unchanged, since polling delivers updated data under stable keys.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnimatedList } from '@/lib/hooks/use-animated-list'

interface TestItem {
  id: string
  hops: string
}

const getKey = (item: TestItem) => item.id

describe('useAnimatedList', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders initial items as stable', () => {
    const { result } = renderHook(
      ({ items }: { items: TestItem[] }) => useAnimatedList(items, { getKey }),
      { initialProps: { items: [{ id: 'remedios-ii', hops: 'Hallertau' }] } },
    )

    expect(result.current).toHaveLength(1)
    expect(result.current[0].state).toBe('stable')
    expect(result.current[0].item.hops).toBe('Hallertau')
  })

  it('reflects in-place item content changes when keys are unchanged', () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: TestItem[] }) => useAnimatedList(items, { getKey }),
      { initialProps: { items: [{ id: 'remedios-ii', hops: 'Hallertau' }] } },
    )

    rerender({ items: [{ id: 'remedios-ii', hops: 'Hallertauer' }] })

    expect(result.current).toHaveLength(1)
    expect(result.current[0].item.hops).toBe('Hallertauer')
  })

  it('marks removed items as exiting while keeping their last-known content', () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: TestItem[] }) => useAnimatedList(items, { getKey }),
      {
        initialProps: {
          items: [
            { id: 'remedios-ii', hops: 'Hallertau' },
            { id: 'origen-iii', hops: 'Citra' },
          ],
        },
      },
    )

    rerender({ items: [{ id: 'remedios-ii', hops: 'Hallertau' }] })

    const exiting = result.current.find((ai) => ai.key === 'origen-iii')
    expect(exiting?.state).toBe('exiting')
    expect(exiting?.item.hops).toBe('Citra')
  })

  it('removes an exiting item even when keys change again before its exit finishes', () => {
    // Regression: the keys-change effect used to clear ALL pending timeouts in
    // its cleanup, so a second key change within exitDuration cancelled an
    // exiting item's removal timeout and stranded it (invisible but mounted)
    // in the list forever.
    vi.useFakeTimers()

    const { result, rerender } = renderHook(
      ({ items }: { items: TestItem[] }) => useAnimatedList(items, { getKey, exitDuration: 500 }),
      {
        initialProps: {
          items: [
            { id: 'remedios-ii', hops: 'Hallertau' },
            { id: 'origen-iii', hops: 'Citra' },
            { id: 'luptak', hops: 'Simcoe' },
          ],
        },
      },
    )

    // Remove A, then remove B 200ms later — inside A's 500ms exit window
    rerender({
      items: [
        { id: 'origen-iii', hops: 'Citra' },
        { id: 'luptak', hops: 'Simcoe' },
      ],
    })
    act(() => vi.advanceTimersByTime(200))
    rerender({ items: [{ id: 'luptak', hops: 'Simcoe' }] })
    act(() => vi.advanceTimersByTime(1000))

    expect(result.current.map((ai) => ai.key)).toEqual(['luptak'])
  })
})
