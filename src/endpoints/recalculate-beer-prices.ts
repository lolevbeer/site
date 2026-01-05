import type { PayloadHandler } from 'payload'
import { getUserFromRequest } from './auth-helper'

export const recalculateBeerPrices: PayloadHandler = async (req) => {
  const { payload } = req
  const user = req.user ?? await getUserFromRequest(req, payload)

  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const url = new URL(req.url || '', 'http://localhost')
  const dryRun = url.searchParams.get('dryRun') === 'true'

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      const results = { updated: 0, skipped: 0, errors: 0 }

      try {
        send('status', { message: 'Fetching all beers for recalculation...' })

        const beersResult = await payload.find({
          collection: 'beers',
          limit: 1000,
          depth: 0,
        })

        send('status', { message: `Recalculating fields for ${beersResult.docs.length} beers...` })

        for (const beer of beersResult.docs) {
          try {
            // Skip beers with halfPourOnly enabled - they use manual pricing
            if (beer.halfPourOnly) {
              send('status', { message: `Skipping ${beer.name} (half pour only)` })
              results.skipped++
              continue
            }

            if (!dryRun) {
              // Simply update the beer - the beforeChange hook will recalculate fields
              await payload.update({
                collection: 'beers',
                id: beer.id,
                data: {
                  draftPrice: beer.draftPrice,
                  fourPack: beer.fourPack,
                },
              })
            }
            results.updated++
            send('status', { message: `${dryRun ? 'Would recalculate' : 'Recalculated'}: ${beer.name}` })
          } catch (error: any) {
            send('error', { message: `Error recalculating ${beer.name}: ${error.message}` })
            results.errors++
          }
        }

        send('status', { message: `Complete: ${results.updated} updated, ${results.skipped} skipped, ${results.errors} errors` })
        send('complete', { success: true, results, dryRun })
      } catch (error: any) {
        send('error', { message: error.message })
        send('complete', { success: false, error: error.message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
