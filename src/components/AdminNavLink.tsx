'use client'

import { useEffect, ReactNode } from 'react'

export function AdminNavLink({ children }: { children: ReactNode }) {
  useEffect(() => {
    const homeElement = document.querySelector('.step-nav__home')
    if (homeElement) {
      const handleClick = () => {
        window.location.href = '/'
      }
      homeElement.addEventListener('click', handleClick)
      ;(homeElement as HTMLElement).style.cursor = 'pointer'
      return () => homeElement.removeEventListener('click', handleClick)
    }
  }, [])

  return <>{children}</>
}
