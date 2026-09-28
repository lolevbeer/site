'use client'

/**
 * Drops the public footer on fullscreen routes (menu boards, event screens).
 * Uses the pathname only, so it stays outside the location provider's
 * search-param Suspense boundary and the footer HTML is in the document.
 */

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export function FooterGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const skipChrome =
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/api') ||
    pathname?.startsWith('/m/') ||
    pathname?.startsWith('/e/')

  if (skipChrome) return null
  return children
}
