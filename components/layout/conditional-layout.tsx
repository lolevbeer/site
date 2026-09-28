'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { Header } from '@/components/layout/header'

interface ConditionalLayoutProps {
  children: React.ReactNode
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname()

  const skipChrome =
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/api') ||
    pathname?.startsWith('/m/') ||
    pathname?.startsWith('/e/')

  if (skipChrome) {
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
