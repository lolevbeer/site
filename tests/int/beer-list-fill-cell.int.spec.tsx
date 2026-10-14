/**
 * Beers list cells: an empty Untappd URL or Tag can be filled straight from
 * /admin/collections/beers. Untappd opens a drawer of search results with a
 * recommended match; Tag uses Payload's select. A beer whose latest version
 * is a draft saves as a draft, so filling a blank never publishes someone's
 * unfinished edits.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import type { DefaultCellComponentProps } from 'payload'
import { TagCell, UntappdCell } from '@/src/components/admin/BeerListFillCell'

type Opt = { label: string; value: string }
const state = vi.hoisted(() => ({ canUpdate: true, refresh: vi.fn(), openModal: vi.fn() }))
vi.mock('@payloadcms/ui', () => ({
  useAuth: () => ({
    permissions: { collections: { beers: state.canUpdate ? { update: true } : {} } },
  }),
  useModal: () => ({ openModal: state.openModal, closeModal: vi.fn() }),
  useDrawerSlug: (slug: string) => slug,
  DefaultCell: ({ cellData }: { cellData: unknown }) => <span>default:{String(cellData)}</span>,
  Drawer: ({ children, title }: { children: ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
  Button: ({
    buttonStyle: _style,
    size: _size,
    margin: _margin,
    ...props
  }: ComponentProps<'button'> & { buttonStyle?: string; size?: string; margin?: boolean }) => (
    <button {...props} />
  ),
  Select: ({ options, onChange }: { options: Opt[]; onChange: (o: Opt) => void }) => (
    <div>
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
  state.openModal.mockReset()
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
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('searches Untappd by beer name and recommends the exact name match', async () => {
    render(<UntappdCell {...props(null, 'published')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Find on Untappd' }))
    expect(state.openModal).toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith('/api/untappd?action=search&q=Lupula', expect.anything())

    const recommended = await screen.findByText('Recommended')
    const row = recommended.closest('li') as HTMLElement
    expect(within(row).getByText('Lupula')).toBeTruthy()
  })

  it('saves the chosen result on a published beer as a normal update', async () => {
    render(<UntappdCell {...props(null, 'published')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Find on Untappd' }))
    const row = (await screen.findByText('Recommended')).closest('li') as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: 'Use this' }))
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
