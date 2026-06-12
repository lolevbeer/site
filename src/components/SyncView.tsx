import type { AdminViewServerProps } from 'payload'

import { DefaultTemplate } from '@payloadcms/next/templates'
import { redirect } from 'next/navigation'
import React from 'react'

import { SyncViewClient } from './SyncViewClient'
import { isAdmin } from '@/src/access/roles'

/**
 * Admin-only Sync tools view. Payload custom views are public by default,
 * so this gates server-side: anonymous visitors go to the login screen
 * (returning here after auth) and non-admin users get Payload's
 * unauthorized view. The import/sync endpoints enforce their own auth
 * separately — the food-vendor CSV endpoint still permits food-manager.
 */
export const SyncView: React.FC<AdminViewServerProps> = ({
  initPageResult,
  params,
  searchParams,
}) => {
  const user = initPageResult.req.user
  const { routes } = initPageResult.req.payload.config

  if (!user) {
    redirect(`${routes.admin}/login?redirect=${encodeURIComponent(`${routes.admin}/sync`)}`)
  }

  if (!isAdmin(user)) {
    redirect(`${routes.admin}/unauthorized`)
  }

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <SyncViewClient />
    </DefaultTemplate>
  )
}

export default SyncView
