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

describe('useLocationSearch request', () => {
  /** Type a term, wait out the debounce, and return the URL the hook asked Mapbox for. */
  async function requestedUrl(
    term: string,
    proximity: { latitude: number; longitude: number } | null,
  ) {
    fetchMock.mockResolvedValue({ ok: true, json: async () => mapboxBody('Amsterdam') })
    const { result } = renderHook(() => useLocationSearch(proximity))
    act(() => {
      result.current.setSearchTerm(term)
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    return new URL(String(fetchMock.mock.calls[0][0]))
  }

  it('is not limited to one country, so visitors can search for a place abroad', async () => {
    const url = await requestedUrl('Amsterdam', null)
    expect(url.searchParams.has('country')).toBe(false)
    expect(url.searchParams.get('types')).toContain('place')
  })

  it('still biases results toward the visitor when their location is known', async () => {
    const url = await requestedUrl('Amsterdam', { latitude: 40.44, longitude: -79.99 })
    expect(url.searchParams.get('proximity')).toBe('-79.99,40.44')
    expect(url.searchParams.has('country')).toBe(false)
  })
})

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

describe('useLocationSearch explicit search', () => {
  /** Hold the explicit search's Mapbox response until the test releases it. */
  function deferFirstFetch() {
    let release: (() => void) | undefined
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ ok: true, json: async () => mapboxBody('Pittsburgh') })
        }),
    )
    fetchMock.mockResolvedValue({ ok: true, json: async () => mapboxBody('Other') })
    return () => release?.()
  }

  const outlastDebounce = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 320))
    })

  it('is not aborted by the autocomplete debounce armed while typing', async () => {
    const release = deferFirstFetch()
    const { result } = renderHook(() => useLocationSearch(null))

    act(() => {
      result.current.setSearchTerm('Pittsburgh')
    })
    let commit: Promise<boolean | null> | undefined
    act(() => {
      commit = result.current.commitTypedPlace()
    })
    await outlastDebounce()
    release()

    await act(async () => {
      await expect(commit).resolves.toBe(true)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports null, not a failed search, when newer typing supersedes it', async () => {
    const release = deferFirstFetch()
    const { result } = renderHook(() => useLocationSearch(null))

    act(() => {
      result.current.setSearchTerm('Pitt')
    })
    let commit: Promise<boolean | null> | undefined
    act(() => {
      commit = result.current.commitTypedPlace()
    })
    act(() => {
      result.current.setSearchTerm('Pittsburgh')
    })
    await outlastDebounce()
    release()

    await act(async () => {
      await expect(commit).resolves.toBeNull()
    })
  })
})
