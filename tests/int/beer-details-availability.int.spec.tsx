/**
 * BeerDetails renders taproom availability from server-provided props (no
 * client /api/menus fetch): taproom names link to their landing pages, and a
 * failed menu load (availability = null) says so instead of guessing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { Beer } from '@/src/payload-types'
import { BeerDetails } from '@/components/beer/beer-details'

vi.mock('@/components/beer/admin-edit-button', () => ({ AdminEditButton: () => null }))
vi.mock('@/components/beer/beer-can-3d', () => ({ BeerCan3D: () => null }))

afterEach(cleanup)

const beer = { id: 'b1', slug: 'akko', name: 'Akko', abv: 6.2, draftPrice: 8, fourPack: 18 } as Beer

describe('BeerDetails availability', () => {
  it('links each taproom on draft and in cans without fetching', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(
      <BeerDetails
        beer={beer}
        availability={{
          tap: [
            { name: 'Lawrenceville', slug: 'lawrenceville' },
            { name: 'Zelienople', slug: 'zelienople' },
          ],
          cans: [{ name: 'Zelienople', slug: 'zelienople' }],
        }}
      />,
    )
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(screen.getByText(/On draft at/).textContent).toBe(
      '• On draft at Lawrenceville and Zelienople',
    )
    expect(screen.getByRole('link', { name: 'Lawrenceville' }).getAttribute('href')).toBe(
      '/lawrenceville',
    )
    expect(screen.getByText(/Cans available at/).textContent).toBe('• Cans available at Zelienople')
    // Prices follow availability: draft and 4-pack both show.
    expect(screen.getByText(/Draft \$8/)).toBeTruthy()
    expect(screen.getByText(/4 Pack \$18/)).toBeTruthy()
    fetchSpy.mockRestore()
  })

  it('says it is not on tap anywhere when no menu lists it', () => {
    render(<BeerDetails beer={beer} availability={{ tap: [], cans: [] }} />)
    expect(screen.getByText('Not currently available at our taprooms')).toBeTruthy()
  })

  it('makes no availability claim when menus failed to load', () => {
    render(<BeerDetails beer={beer} availability={null} />)
    expect(screen.queryByText('Not currently available at our taprooms')).toBeNull()
    expect(screen.getByText(/availability is unavailable/i)).toBeTruthy()
  })
})
