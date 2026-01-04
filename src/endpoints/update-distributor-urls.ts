import type { PayloadHandler } from 'payload'

export const updateDistributorUrls: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user || !user.roles?.includes('admin')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json?.()

    if (!body) {
      return Response.json({ error: 'No body provided' }, { status: 400 })
    }

    const { distributorPaUrl, distributorOhUrl } = body

    // Use the local API to update the global
    await payload.updateGlobal({
      slug: 'site-content',
      data: {
        distributorPaUrl: distributorPaUrl || '',
        distributorOhUrl: distributorOhUrl || '',
      },
    })

    return Response.json({ success: true })
  } catch (error: any) {
    console.error('Failed to update distributor URLs:', error)
    return Response.json({ error: error.message || 'Failed to update' }, { status: 500 })
  }
}
