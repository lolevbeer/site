/**
 * UntappdFetcher writes a fetched rating into the beer form. A response must only
 * land if the form still points at the URL it was fetched for.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const state = vi.hoisted(() => ({
  fields: {} as Record<string, unknown>,
  writes: [] as [string, unknown][],
}))

vi.mock('@payloadcms/ui', async () => {
  const { useReducer } = await import('react')
  return {
    // Like the real hook, setting a value re-renders the component.
    useField: ({ path }: { path: string }) => {
      const [, rerender] = useReducer((n: number) => n + 1, 0)
      return {
        value: state.fields[path],
        setValue: (value: unknown) => {
          state.fields[path] = value
          state.writes.push([path, value])
          rerender()
        },
      }
    },
    Button: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
      <button onClick={onClick}>{children}</button>
    ),
    Banner: ({ children }: { children: React.ReactNode }) => <div role="alert">{children}</div>,
  }
})

import { UntappdFetcher } from '@/src/components/admin/UntappdFetcher'

const rating = { rating: 4.2, ratingCount: 10, positiveReviews: [{ url: 'r1' }] }
const respond = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response

/** Hold the rating response until the test releases it. */
function deferFetch() {
  let release: (response: Response) => void = () => {}
  vi.mocked(fetch).mockImplementation(() => new Promise((resolve) => (release = resolve)))
  return (response: Response) => release(response)
}

const settle = () => new Promise((resolve) => setTimeout(resolve))

beforeEach(() => {
  state.fields = { name: 'Lupula', untappd: '/b/a/1', positiveReviews: [] }
  state.writes = []
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('UntappdFetcher', () => {
  it('applies rating, count and new reviews for the same URL', async () => {
    vi.mocked(fetch).mockResolvedValue(respond(rating))
    render(<UntappdFetcher />)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Rating' }))
    await waitFor(() => expect(state.fields.untappdRating).toBe(4.2))
    expect(state.fields.untappdRatingCount).toBe(10)
    expect(state.fields.positiveReviews).toEqual([{ url: 'r1' }])
  })

  it('applies the rating of a URL chosen from search', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(respond({ results: [{ name: 'Lupula', url: '/b/new/2' }] }))
      .mockResolvedValueOnce(respond(rating))
    render(<UntappdFetcher />)
    fireEvent.click(screen.getByRole('button', { name: 'Search Untappd' }))
    await waitFor(() => expect(state.fields.untappdRating).toBe(4.2))
    expect(state.fields.untappd).toBe('/b/new/2')
  })

  it('drops a response when the URL changed while it was in flight', async () => {
    const release = deferFetch()
    const { rerender } = render(<UntappdFetcher />)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Rating' }))
    state.fields.untappd = '/b/b/2'
    rerender(<UntappdFetcher />)

    release(respond(rating))
    await settle()

    expect(state.writes).toEqual([])
  })

  it('drops a failure for a URL that is no longer in the form', async () => {
    const release = deferFetch()
    const { rerender } = render(<UntappdFetcher />)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Rating' }))
    state.fields.untappd = '/b/b/2'
    rerender(<UntappdFetcher />)

    release({ ok: false, json: async () => ({ error: 'stale failure' }) } as unknown as Response)
    await settle()

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('drops a response that arrives after the form is gone', async () => {
    const release = deferFetch()
    const { unmount } = render(<UntappdFetcher />)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Rating' }))
    unmount()

    release(respond(rating))
    await settle()

    expect(state.writes).toEqual([])
  })
})
