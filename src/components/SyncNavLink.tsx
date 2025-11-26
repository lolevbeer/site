'use client'

import React from 'react'
import { NavGroup } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'

export const SyncNavLink: React.FC = () => {
  const pathname = usePathname()
  const isActive = pathname === '/admin/sync'

  return (
    <NavGroup label="Tools">
      <div>
        <a
          href="/admin/sync"
          className={`nav-group__link ${isActive ? 'nav-group__link--active' : ''}`}
        >
          <span className="nav-group__link-label">Sync</span>
        </a>
      </div>
    </NavGroup>
  )
}
