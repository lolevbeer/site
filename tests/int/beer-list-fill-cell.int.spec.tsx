/**
 * BeerListFillCell: blank Untappd/Tag cells on /admin/collections/beers are
 * filled in place. Saves read the beer's latest status first, so a pending
 * draft stays a draft even when the Status column (and `_status`) is hidden.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { DefaultCellComponentProps } from 'payload'
import { resetTagsRequest, TagCell, UntappdCell } from '@/src/components/admin/BeerListFillCell'

type Opt = { label: string; value: string }
const state = vi.hoisted(() => ({ canUpdate: true, refresh: vi.fn(), status: 'published' }))
vi.mock('@payloadcms/ui', () => ({
  useAuth: () => ({
    permissions: { collections: { beers: state.canUpdate ? { update: true } : {} } },
  }),
  DefaultCell: ({ cellData }: { cellData: unknown }) => <span>default:{String(cellData)}</span>,
  // Stand-in for Payload's react-select: a menu opener, the search input, and one button per option.
  Select: ({
    options,
    onChange,
    onMenuOpen,
    onInputChange,
    isLoading,
    'aria-label': label,
  }: {
    options: Opt[]
    isLoading?: boolean
    onChange: (o: Opt) => void
    onMenuOpen?: () => void
    onInputChange?: (v: string, meta: { action: string }) => void
    'aria-label'?: string
  }) => (
    <div data-loading={String(Boolean(isLoading))}>
      <button onClick={onMenuOpen}>open:{label}</button>
      <input
        aria-label={`search:${label}`}
        onChange={(e) => onInputChange?.(e.target.value, { action: 'input-change' })}
        onBlur={() => onInputChange?.('', { action: 'input-blur' })}
      />
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o)}>
          option:{o.label}
        </button>
      ))}
    </div>
  ),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: state.refresh }) }))

// The list view only selects visible columns, so rows here carry no `_status`.
const props = (cellData: unknown) =>
  ({ cellData, rowData: { id: 'beer-1', name: 'Lupula' } }) as unknown as DefaultCellComponentProps

const searchResults = [
  { name: 'Lupula Light', url: 'https://untappd.com/b/lolev-lupula-light/2', brewery: 'Lolev' },
  { name: 'Lupula', url: 'https://untappd.com/b/lolev-lupula/1', brewery: 'Lolev' },
]

const respond = (body: unknown) => ({ ok: true, json: async () => body })
const calls = (prefix: string) =>
  vi.mocked(fetch).mock.calls.filter(([url]) => String(url).startsWith(prefix))

beforeEach(() => {
  state.canUpdate = true
  state.status = 'published'
  state.refresh.mockReset()
  resetTagsRequest()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('/api/tags')) return respond({ docs: [{ id: 'tag-1', name: 'Seasonal' }] })
      if (url.startsWith('/api/untappd')) return respond({ results: searchResults })
      if (init?.method === 'PATCH') return respond({})
      return respond({ _status: state.status })
    }),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Beers list fill cells', () => {
  it('shows the normal cell when a value is set', () => {
    render(<UntappdCell {...props('/b/x/1')} />)
    expect(screen.getByText('default:/b/x/1')).toBeTruthy()
  })

  it('shows nothing editable to users who cannot update beers', () => {
    state.canUpdate = false
    render(<UntappdCell {...props(null)} />)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('searches Untappd by beer name on open and lists the exact name match first', async () => {
    render(<UntappdCell {...props(null)} />)
    fireEvent.click(screen.getByRole('button', { name: 'open:Untappd URL' }))
    const first = await screen.findByRole('button', { name: /^option:★ Lupula/ })
    expect(fetch).toHaveBeenCalledWith('/api/untappd?action=search&q=Lupula', expect.anything())
    const options = screen.getAllByRole('button', { name: /^option:/ })
    expect(options[0]).toBe(first)
    expect(options[1].textContent).toContain('Lupula Light')
  })

  it('searches again with typed text, but not when the input is cleared on blur', async () => {
    vi.useFakeTimers()
    try {
      render(<UntappdCell {...props(null)} />)
      const input = screen.getByRole('textbox', { name: 'search:Untappd URL' })
      fireEvent.change(input, { target: { value: 'Lupula IPA' } })
      await vi.advanceTimersByTimeAsync(400)
      expect(calls('/api/untappd').map(([u]) => u)).toEqual([
        '/api/untappd?action=search&q=Lupula%20IPA',
      ])
      fireEvent.blur(input)
      await vi.advanceTimersByTimeAsync(400)
      expect(calls('/api/untappd')).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('saves to a published beer as a normal update, reading status fresh', async () => {
    render(<UntappdCell {...props(null)} />)
    fireEvent.click(screen.getByRole('button', { name: 'open:Untappd URL' }))
    fireEvent.click(await screen.findByRole('button', { name: /^option:★ Lupula/ }))
    await waitFor(() => expect(state.refresh).toHaveBeenCalled())
    expect(fetch).toHaveBeenCalledWith(
      '/api/beers/beer-1?draft=true&depth=0&select[_status]=true',
      expect.anything(),
    )
    expect(fetch).toHaveBeenCalledWith(
      '/api/beers/beer-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ untappd: 'https://untappd.com/b/lolev-lupula/1' }),
      }),
    )
  })

  it('saves a tag on a draft beer as a draft', async () => {
    state.status = 'draft'
    render(<TagCell {...props(null)} />)
    fireEvent.click(screen.getByRole('button', { name: 'open:Tag' }))
    fireEvent.click(await screen.findByRole('button', { name: 'option:Seasonal' }))
    await waitFor(() => expect(state.refresh).toHaveBeenCalled())
    expect(fetch).toHaveBeenCalledWith(
      '/api/beers/beer-1?draft=true',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ tag: 'tag-1' }) }),
    )
  })

  it('shows no loading spinner on an unopened Tag cell', () => {
    const { container } = render(<TagCell {...props(null)} />)
    expect(container.querySelector('[data-loading]')?.getAttribute('data-loading')).toBe('false')
  })

  it('loads tags once for the whole page, and only when a menu is opened', async () => {
    render(
      <>
        <TagCell {...props(null)} />
        <TagCell {...props(null)} />
      </>,
    )
    expect(calls('/api/tags')).toHaveLength(0)
    for (const opener of screen.getAllByRole('button', { name: 'open:Tag' }))
      fireEvent.click(opener)
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'option:Seasonal' })).toHaveLength(2),
    )
    expect(calls('/api/tags')).toHaveLength(1)
  })

  it('reports a failed save', async () => {
    render(<TagCell {...props(null)} />)
    fireEvent.click(screen.getByRole('button', { name: 'open:Tag' }))
    const option = await screen.findByRole('button', { name: 'option:Seasonal' })
    vi.mocked(fetch).mockImplementation(async (_url, init) =>
      init?.method === 'PATCH'
        ? ({
            ok: false,
            status: 403,
            json: async () => ({ errors: [{ message: 'Nope' }] }),
          } as Response)
        : (respond({ _status: 'published' }) as Response),
    )
    fireEvent.click(option)
    expect((await screen.findByRole('alert')).textContent).toContain('Nope')
    expect(state.refresh).not.toHaveBeenCalled()
  })
})
