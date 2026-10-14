/**
 * Beers list cells: an empty Untappd URL or Tag can be filled straight from
 * /admin/collections/beers. Both use Payload's select: Untappd searches by
 * the beer's name (or typed text) and lists the exact name match first. A beer whose latest version
 * is a draft saves as a draft, so filling a blank never publishes someone's
 * unfinished edits.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { DefaultCellComponentProps } from 'payload'
import { TagCell, UntappdCell } from '@/src/components/admin/BeerListFillCell'

type Opt = { label: string; value: string }
const state = vi.hoisted(() => ({ canUpdate: true, refresh: vi.fn() }))
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
    'aria-label': label,
  }: {
    options: Opt[]
    onChange: (o: Opt) => void
    onMenuOpen?: () => void
    onInputChange?: (v: string) => void
    'aria-label'?: string
  }) => (
    <div>
      <button onClick={onMenuOpen}>open:{label}</button>
      <input aria-label={`search:${label}`} onChange={(e) => onInputChange?.(e.target.value)} />
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o)}>
          option:{o.label}
        </button>
      ))}
    </div>
  ),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: state.refresh }) }))

// The cells only read cellData/rowData; the rest of Payload's props are irrelevant here.
const props = (cellData: unknown, status: string) =>
  ({
    cellData,
    rowData: { id: 'beer-1', name: 'Lupula', _status: status },
  }) as unknown as DefaultCellComponentProps

const searchResults = [
  { name: 'Lupula Light', url: 'https://untappd.com/b/lolev-lupula-light/2', brewery: 'Lolev' },
  { name: 'Lupula', url: 'https://untappd.com/b/lolev-lupula/1', brewery: 'Lolev' },
]

beforeEach(() => {
  state.canUpdate = true
  state.refresh.mockReset()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.startsWith('/api/tags')
          ? { docs: [{ id: 'tag-1', name: 'Seasonal' }] }
          : url.startsWith('/api/untappd')
            ? { results: searchResults }
            : {},
    })),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Beers list fill cells', () => {
  it('shows the normal cell when a value is set', () => {
    render(<UntappdCell {...props('/b/x/1', 'published')} />)
    expect(screen.getByText('default:/b/x/1')).toBeTruthy()
  })

  it('shows nothing editable to users who cannot update beers', () => {
    state.canUpdate = false
    render(<UntappdCell {...props(null, 'published')} />)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('searches Untappd by beer name on open and lists the exact name match first', async () => {
    render(<UntappdCell {...props(null, 'published')} />)
    fireEvent.click(screen.getByRole('button', { name: 'open:Untappd URL' }))
    const first = await screen.findByRole('button', { name: /^option:★ Lupula/ })
    expect(fetch).toHaveBeenCalledWith('/api/untappd?action=search&q=Lupula', expect.anything())
    const options = screen.getAllByRole('button', { name: /^option:/ })
    expect(options[0]).toBe(first)
    expect(options[1].textContent).toContain('Lupula Light')
  })

  it('searches again with typed text', async () => {
    render(<UntappdCell {...props(null, 'published')} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'search:Untappd URL' }), {
      target: { value: 'Lupula IPA' },
    })
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/untappd?action=search&q=Lupula%20IPA',
        expect.anything(),
      ),
    )
  })

  it('saves the chosen result on a published beer as a normal update', async () => {
    render(<UntappdCell {...props(null, 'published')} />)
    fireEvent.click(screen.getByRole('button', { name: 'open:Untappd URL' }))
    fireEvent.click(await screen.findByRole('button', { name: /^option:★ Lupula/ }))
    await waitFor(() => expect(state.refresh).toHaveBeenCalled())
    expect(fetch).toHaveBeenCalledWith(
      '/api/beers/beer-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ untappd: 'https://untappd.com/b/lolev-lupula/1' }),
      }),
    )
  })

  it('saves a tag on a draft beer as a draft', async () => {
    render(<TagCell {...props(null, 'draft')} />)
    fireEvent.click(await screen.findByRole('button', { name: 'option:Seasonal' }))
    await waitFor(() => expect(state.refresh).toHaveBeenCalled())
    expect(fetch).toHaveBeenCalledWith(
      '/api/beers/beer-1?draft=true',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ tag: 'tag-1' }) }),
    )
  })

  it('reports a failed save', async () => {
    render(<TagCell {...props(null, 'published')} />)
    const option = await screen.findByRole('button', { name: 'option:Seasonal' })
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ errors: [{ message: 'Nope' }] }),
    } as Response)
    fireEvent.click(option)
    expect((await screen.findByRole('alert')).textContent).toContain('Nope')
    expect(state.refresh).not.toHaveBeenCalled()
  })
})
