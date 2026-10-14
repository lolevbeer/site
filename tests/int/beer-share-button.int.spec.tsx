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
// The canonical beer URL, not the current address (no ?loc=, no /<taproom>/ prefix).
const canonical = `${window.location.origin}/beer/akko`

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

    expect(share).toHaveBeenCalledWith({ title: 'Akko', url: canonical })
  })

  it('copies the link and says so when there is no share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    const button = renderBeer()
    await act(async () => fireEvent.click(button))

    expect(writeText).toHaveBeenCalledWith(canonical)
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeTruthy()
    // Announced to screen readers, not only shown on the button.
    expect(screen.getByRole('status').textContent).toBe('Link copied')
  })

  it('shares the canonical URL, not the current address', async () => {
    window.history.pushState({}, '', '/lawrenceville/beer/akko?loc=zelienople')
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })

    const button = renderBeer()
    await act(async () => fireEvent.click(button))

    expect(share).toHaveBeenCalledWith({ title: 'Akko', url: canonical })
    window.history.pushState({}, '', '/')
  })

  it('says it could not copy when there is no clipboard', async () => {
    const button = renderBeer()
    await act(async () => fireEvent.click(button))

    expect(screen.queryByRole('button', { name: 'Link copied' })).toBeNull()
    expect(screen.getByRole('status').textContent).toBe("Couldn't copy the link")
  })

  it('says it could not copy when the clipboard refuses', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    const button = renderBeer()
    await act(async () => fireEvent.click(button))

    expect(screen.queryByRole('button', { name: 'Link copied' })).toBeNull()
    expect(screen.getByRole('status').textContent).toBe("Couldn't copy the link")
  })

  it('copies instead when the share sheet fails for a reason other than cancel', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    const button = renderBeer()
    await act(async () => fireEvent.click(button))

    expect(writeText).toHaveBeenCalledWith(canonical)
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeTruthy()
  })

  it('does nothing more when the share sheet is dismissed', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'))
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    const button = renderBeer()
    await act(async () => fireEvent.click(button))

    expect(writeText).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy()
  })

  it('clears its reset timer on unmount', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    const button = renderBeer()
    const before = vi.getTimerCount()
    await act(async () => fireEvent.click(button))
    expect(vi.getTimerCount()).toBe(before + 1)
    cleanup()
    expect(vi.getTimerCount()).toBeLessThanOrEqual(before)
    vi.useRealTimers()
  })
})
