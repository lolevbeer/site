'use client'

import React from 'react'
import { NavGroup, useAuth } from '@payloadcms/ui'
import { usePathname } from 'next/navigation'

import type { User } from '@/src/payload-types'
import { isAdmin } from '@/src/access/roles'

/**
 * "Tools > Sync" link in the admin nav. Hidden for non-admins to match
 * the admin-only gate on the Sync view itself (see SyncView.tsx).
 */
export const SyncNavLink: React.FC = () => {
  const pathname = usePathname()
  const { user } = useAuth<User>()
  const isActive = pathname === '/admin/sync'

  if (!isAdmin(user)) return null

  return (
    <NavGroup label="Tools">
      {/* Payload 4's own nav markup: the wrapper sets the link's inset and
          spacing, and nav__link--selected is its "current page" style. */}
      <div className="nav__link-wrapper">
        <a
          href="/admin/sync"
          className={`nav__link${isActive ? ' nav__link--selected' : ''}`}
          id="nav-sync"
        >
          <span className="nav__link-label">Sync</span>
        </a>
      </div>
    </NavGroup>
  )
}
