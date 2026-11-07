/**
 * Requests an anonymous visitor's browser must not make: the admin session
 * check (one uncached Payload call per page load) and prefetches of beer pages
 * and the beer map (a stale prefetch regenerates that page on the server).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'

vi.mock('next/link', () => ({
  default: ({
    prefetch,
    href,
    children,
    ...props
  }: ComponentProps<'a'> & { prefetch?: boolean }) => (
    <a href={href} data-prefetch={String(prefetch)} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
vi.mock('framer-motion', () => ({
  motion: { div: () => null },
}))

import { ADMIN_BROWSER_KEY, AuthProvider, useAuth } from '@/lib/hooks/use-auth'
import { BeerLinkWrapper } from '@/components/beer/beer-link-wrapper'
import { Footer } from '@/components/layout/footer'
import { Navigation } from '@/components/layout/navigation'

function AuthState() {
  const { isAuthenticated, isLoading } = useAuth()
  return <p>{isLoading ? 'loading' : isAuthenticated ? 'signed in' : 'anonymous'}</p>
}

describe('AuthProvider', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('skips the session check in a browser that has never opened the admin', async () => {
    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    )
    await screen.findByText('anonymous')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('checks the session once the browser has opened the admin', async () => {
    localStorage.setItem(ADMIN_BROWSER_KEY, '1')
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ user: { id: 'u1' } }) })
    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    )
    await screen.findByText('signed in')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })
})

describe('prefetching', () => {
  afterEach(cleanup)

  it('leaves beer page links out of viewport prefetch', () => {
    render(
      <BeerLinkWrapper href="/beer/gray-wolf" label="Gray Wolf">
        <span />
      </BeerLinkWrapper>,
    )
    expect(screen.getByRole('link', { name: 'Gray Wolf' }).dataset.prefetch).toBe('false')
  })

  it('leaves the beer map out of nav prefetch but keeps the other pages', () => {
    render(<Navigation />)
    expect(screen.getByRole('link', { name: 'Find Our Beer' }).dataset.prefetch).toBe('false')
    expect(screen.getByRole('link', { name: 'Beer' }).dataset.prefetch).toBe('undefined')
  })

  // /admin is dynamic: a prefetch would render Payload on every footer view.
  it('leaves the footer admin link out of prefetch', () => {
    const { container } = render(<Footer taprooms={null} />)
    expect(container.querySelector<HTMLElement>('a[href="/admin"]')?.dataset.prefetch).toBe('false')
  })
})
