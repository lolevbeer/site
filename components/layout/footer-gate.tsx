'use client'

/**
 * Drops the public footer on fullscreen routes (menu boards, event screens).
 * Uses the pathname only, so it stays outside the location provider's
 * search-param Suspense boundary and the footer HTML is in the document.
 */

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { hidesSiteChrome } from '@/components/layout/conditional-layout'

export function FooterGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (hidesSiteChrome(pathname)) return null
  return children
}
