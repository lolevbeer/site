'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { Header } from '@/components/layout/header'

interface ConditionalLayoutProps {
  children: React.ReactNode
}

/** Menu boards, event screens, and non-public routes render without site chrome. */
export function hidesSiteChrome(pathname: string | null): boolean {
  if (!pathname) return false
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/m/') ||
    pathname.startsWith('/e/')
  )
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname()

  if (hidesSiteChrome(pathname)) {
    return (
      <main id="main-content" tabIndex={-1} className="h-screen outline-none">
        {children}
      </main>
    )
  }

  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
    </>
  )
}
