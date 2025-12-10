'use client'

import React from 'react'
import { NavGroup } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'

export const SyncNavLink: React.FC = () => {
  const pathname = usePathname()
  const isActive = pathname === '/admin/sync'

  return (
    <NavGroup label="Tools">
      <a
        href="/admin/sync"
        className={`nav__link${isActive ? ' nav__link--active' : ''}`}
        id="nav-sync"
      >
        <span className="nav__link-label">Sync</span>
      </a>
    </NavGroup>
  )
}
