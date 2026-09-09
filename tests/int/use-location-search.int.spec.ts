/**
 * Map search must ignore stale Mapbox responses when the query changes.
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocationSearch } from '@/lib/hooks/use-location-search'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN', 'pk.test')
})

afterEach(() => {
  cleanup()
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

function mapboxBody(label: string) {
  return {
    features: [
      {
        id: `place.${label}`,
        text: label,
        place_name: `${label}, Pennsylvania`,
        center: [-79.99, 40.44],
      },
    ],
  }
}

describe('useLocationSearch', () => {
  it('does not apply a slower earlier response after the query changes', async () => {
    let resolveFirst: ((value: Response) => void) | undefined
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve as (value: Response) => void
          }),
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mapboxBody('Pittsburgh'),
      })

    const { result } = renderHook(() => useLocationSearch(null))

    act(() => {
      result.current.setSearchTerm('Pi')
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 320))
    })

    act(() => {
      result.current.setSearchTerm('Pittsburgh')
    })
    await waitFor(() => {
      expect(result.current.placeSuggestions[0]?.label).toBe('Pittsburgh')
    })

    await act(async () => {
      resolveFirst?.({
        ok: true,
        json: async () => mapboxBody('Phoenixville'),
      } as Response)
      await Promise.resolve()
    })

    expect(result.current.placeSuggestions[0]?.label).toBe('Pittsburgh')
  })
})
