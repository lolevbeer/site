import type { PayloadHandler } from 'payload'
import { getUserFromRequest } from './auth-helper'
import { isDistributorImportUrl } from '@/lib/distributors/import-source'
import { logger } from '@/lib/utils/logger'

export const updateDistributorUrls: PayloadHandler = async (req) => {
  const { payload } = req
  const user = req.user ?? (await getUserFromRequest(req, payload))

  if (!user || !user.roles?.includes('admin')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json?.()

    if (!body) {
      return Response.json({ error: 'No body provided' }, { status: 400 })
    }

    const { distributorPaUrl, distributorOhUrl } = body

    if (
      [distributorPaUrl, distributorOhUrl].some((value) => value && !isDistributorImportUrl(value))
    ) {
      return Response.json({ error: 'Use an HTTPS Encompass8 QuickLink URL.' }, { status: 400 })
    }

    // Use the local API to update the global
    await payload.updateGlobal({
      slug: 'site-content',
      data: {
        distributorPaUrl: distributorPaUrl || '',
        distributorOhUrl: distributorOhUrl || '',
      },
      overrideAccess: false,
      user,
    })

    return Response.json({ success: true })
  } catch (error: unknown) {
    logger.error('Failed to update distributor URLs:', error)
    const message = error instanceof Error ? error.message : 'Failed to update'
    return Response.json({ error: message }, { status: 500 })
  }
}
