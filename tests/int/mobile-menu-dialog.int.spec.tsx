/** Mobile navigation delegates modal keyboard and focus behavior to Radix Dialog. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, type ComponentProps } from 'react'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
vi.mock('next/link', () => ({
  default: ({ children, ...props }: ComponentProps<'a'>) => createElement('a', props, children),
}))
vi.mock('@/components/location/location-tabs', () => ({ LocationTabs: () => null }))

import { Header } from '@/components/layout/header'

let isDesktop = false
const desktopListeners = new Set<(event: MediaQueryListEvent) => void>()
function setDesktopViewport(matches: boolean) {
  act(() => {
    isDesktop = matches
    desktopListeners.forEach((listener) => listener({ matches } as MediaQueryListEvent))
  })
}

function openMenu() {
  const trigger = screen.getByRole('button', { name: 'Open menu' })
  fireEvent.click(trigger)
  return { dialog: screen.getByRole('dialog', { name: 'Mobile navigation menu' }), trigger }
}

afterEach(cleanup)

beforeEach(() => {
  isDesktop = false
  desktopListeners.clear()
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      get matches() {
        return query === '(prefers-reduced-motion)' ? true : isDesktop
      },
      media: query,
      onchange: null,
      addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => desktopListeners.add(listener),
      removeEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => desktopListeners.delete(listener),
      addListener: (listener: (event: MediaQueryListEvent) => void) => desktopListeners.add(listener),
      removeListener: (listener: (event: MediaQueryListEvent) => void) => desktopListeners.delete(listener),
      dispatchEvent: () => true,
    })),
  )
})

describe('mobile navigation dialog', () => {
  it('contains focus and restores it to the trigger after Escape', async () => {
    render(createElement(Header))
    const { dialog, trigger } = openMenu()
    const close = screen.getByRole('button', { name: 'Close menu' })

    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

    const focusableElements = dialog.querySelectorAll<HTMLElement>('a[href], button')
    const first = focusableElements[0]
    const last = focusableElements[focusableElements.length - 1]
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    first.focus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger)
    expect(close).toBeTruthy()
  })

  it('closes on outside interaction and releases scroll lock', async () => {
    render(createElement(Header))
    const { dialog, trigger } = openMenu()

    await waitFor(() => expect(document.body.dataset.scrollLocked).toBe('1'))
    await new Promise<void>((resolve) => setTimeout(resolve))
    const overlay = dialog.previousElementSibling
    expect(overlay?.getAttribute('data-state')).toBe('open')
    expect(overlay?.classList.contains('backdrop-blur-xl')).toBe(true)
    fireEvent.pointerDown(overlay!, { button: 0, pointerType: 'mouse' })
    fireEvent.pointerUp(overlay!, { button: 0, pointerType: 'mouse' })
    fireEvent.click(overlay!)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.body.dataset.scrollLocked).toBeUndefined()
    expect(document.activeElement).toBe(trigger)
  })

  it('closes when the viewport transitions to desktop', async () => {
    render(createElement(Header))
    const { trigger } = openMenu()

    await waitFor(() => expect(document.body.dataset.scrollLocked).toBe('1'))
    setDesktopViewport(true)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.body.dataset.scrollLocked).toBeUndefined()
    expect(document.activeElement).toBe(trigger)
  })
})
