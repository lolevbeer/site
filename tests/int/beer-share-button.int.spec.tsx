/**
 * The beer page Share button uses the native share sheet where the browser
 * has one (including in-app browsers) and copies the link otherwise.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Beer } from '@/src/payload-types'
import { BeerDetails } from '@/components/beer/beer-details'

vi.mock('@/components/beer/admin-edit-button', () => ({ AdminEditButton: () => null }))
vi.mock('@/components/beer/beer-can-3d', () => ({ BeerCan3D: () => null }))

const beer = { id: 'b1', slug: 'akko', name: 'Akko', abv: 6.2 } as Beer

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'clipboard')
})

function renderBeer() {
  render(<BeerDetails beer={beer} availability={{ tap: [], cans: [] }} />)
  return screen.getByRole('button', { name: 'Share' })
}

describe('BeerDetails share button', () => {
  it('opens the native share sheet with the page URL', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })

    const button = renderBeer()
    await act(async () => fireEvent.click(button))

    expect(share).toHaveBeenCalledWith({ title: 'Akko', url: window.location.href })
  })

  it('copies the link and says so when there is no share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    const button = renderBeer()
    await act(async () => fireEvent.click(button))

    expect(writeText).toHaveBeenCalledWith(window.location.href)
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeTruthy()
  })
})
