/**
 * Beers list cells: an empty Untappd URL or Tag can be filled straight from
 * /admin/collections/beers. A beer whose latest version is a draft saves as a
 * draft, so filling a blank never publishes someone's unfinished edits.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { DefaultCellComponentProps } from 'payload'
import { TagCell, UntappdCell } from '@/src/components/admin/BeerListFillCell'

const state = vi.hoisted(() => ({ canUpdate: true, refresh: vi.fn() }))
vi.mock('@payloadcms/ui', () => ({
  useAuth: () => ({
    permissions: { collections: { beers: state.canUpdate ? { update: true } : {} } },
  }),
  DefaultCell: ({ cellData }: { cellData: unknown }) => <span>default:{String(cellData)}</span>,
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: state.refresh }) }))

// The cells only read cellData/rowData; the rest of Payload's props are irrelevant here.
const props = (cellData: unknown, status: string) =>
  ({ cellData, rowData: { id: 'beer-1', _status: status } }) as unknown as DefaultCellComponentProps

beforeEach(() => {
  state.canUpdate = true
  state.refresh.mockReset()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.startsWith('/api/tags') ? { docs: [{ id: 'tag-1', name: 'Seasonal' }] } : {},
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

  it('saves an Untappd URL on a published beer as a normal (published) update', async () => {
    render(<UntappdCell {...props(null, 'published')} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' /b/lolev-x/9 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(state.refresh).toHaveBeenCalled())
    expect(fetch).toHaveBeenCalledWith(
      '/api/beers/beer-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ untappd: '/b/lolev-x/9' }),
      }),
    )
  })

  it('saves a tag on a draft beer as a draft', async () => {
    render(<TagCell {...props(null, 'draft')} />)
    await screen.findByRole('option', { name: 'Seasonal' })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tag-1' } })
    await waitFor(() => expect(state.refresh).toHaveBeenCalled())
    expect(fetch).toHaveBeenCalledWith(
      '/api/beers/beer-1?draft=true',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ tag: 'tag-1' }) }),
    )
  })

  it('reports a failed save', async () => {
    render(<UntappdCell {...props(null, 'published')} />)
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ errors: [{ message: 'Nope' }] }),
    } as Response)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/b/x/1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Nope')
    expect(state.refresh).not.toHaveBeenCalled()
  })
})
