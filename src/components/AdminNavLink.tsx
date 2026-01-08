'use client'

import { useEffect, ReactNode, useRef } from 'react'
import { usePathname } from 'next/navigation'

export function AdminNavLink({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const handlerRef = useRef<((e: Event) => void) | null>(null)

  useEffect(() => {
    const handleClick = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      window.location.href = '/'
    }
    handlerRef.current = handleClick

    // Small delay to ensure DOM is updated after navigation
    const timer = setTimeout(() => {
      const homeElement = document.querySelector('.step-nav__home')
      if (homeElement) {
        homeElement.addEventListener('click', handleClick)
        ;(homeElement as HTMLElement).style.cursor = 'pointer'
      }
    }, 50)

    return () => {
      clearTimeout(timer)
      const homeElement = document.querySelector('.step-nav__home')
      if (homeElement && handlerRef.current) {
        homeElement.removeEventListener('click', handlerRef.current)
      }
    }
  }, [pathname])

  return <>{children}</>
}
