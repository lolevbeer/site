'use client'

/**
 * Admin panel provider that marks this browser as one that may hold a session,
 * so the public site's AuthProvider knows when checking `/api/users/me` is worth
 * a server call. Holds no credentials: it only gates a cosmetic check.
 */
import { useEffect, type ReactNode } from 'react'
import { ADMIN_BROWSER_KEY } from '@/lib/hooks/use-auth'

export function AdminBrowserMarker({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_BROWSER_KEY, '1')
    } catch {
      // Blocked storage: the public site simply hides its edit buttons here.
    }
  }, [])
  return children
}
