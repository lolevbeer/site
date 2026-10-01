/** Beer visitor summary precedes artwork without changing menu-based pricing. */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BeerDetails } from '@/components/beer/beer-details'
import type { Beer } from '@/src/payload-types'
vi.mock('@/components/beer/admin-edit-button', () => ({ AdminEditButton: () => null }))
vi.mock('@/components/beer/beer-can-3d', () => ({ BeerCan3D: () => null }))
// Plain image stand-in exposes DOM order without Next's image optimizer in jsdom.
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ alt }: { alt: string }) => <img alt={alt} /> }))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const beer = {
  id: 'beer-1',
  name: 'Test Ale',
  slug: 'test-ale',
  abv: 6,
  draftPrice: 7,
  fourPack: 16,
  style: { name: 'Pale Ale' },
  image: { url: '/test.jpg' },
} as Beer

describe('BeerDetails visitor hierarchy', () => {
  it('renders identity, style/ABV, availability and pricing before artwork', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          docs: [
            { type: 'draft', location: { name: 'Lawrenceville' }, items: [{ beer: 'beer-1' }] },
            { type: 'cans', location: { name: 'Zelienople' }, items: [{ beer: 'beer-1' }] },
          ],
        }),
      }),
    )
    render(<BeerDetails beer={beer} />)
    await screen.findByText(/On draft at Lawrenceville/)
    const image = screen.getByAltText('Test Ale beer')
    for (const node of [
      screen.getByRole('heading', { level: 1 }),
      screen.getByText('Pale Ale'),
      screen.getByText('6.0%'),
      screen.getByText(/On draft at Lawrenceville/),
      screen.getByText(/Draft \$7/),
    ]) {
      expect(node.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
  it('preserves location fetch errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    render(<BeerDetails beer={beer} />)
    expect(
      await screen.findByText('Unable to load location information. Please try again later.'),
    ).toBeTruthy()
  })
})
