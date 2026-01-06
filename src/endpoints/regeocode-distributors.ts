import type { PayloadHandler } from 'payload'
import { getUserFromRequest } from './auth-helper'
import { geocodeAddress, geocodeFallback } from './geocode'

// Default coordinates used as fallbacks during import
const DEFAULT_COORDS: Record<string, [number, number]> = {
  PA: [-79.9959, 40.4406], // Pittsburgh
  OH: [-82.9988, 39.9612], // Columbus
  NY: [-77.6109, 43.1566], // Rochester area
  WV: [-79.9959, 40.4406], // Use Pittsburgh for WV too
}

// Tolerance for matching (about 10 meters)
const COORD_TOLERANCE = 0.0001

function isSuspiciousCoordinate(location: [number, number], region: string): boolean {
  const defaultCoord = DEFAULT_COORDS[region]
  if (!defaultCoord) return false

  return (
    Math.abs(location[0] - defaultCoord[0]) < COORD_TOLERANCE &&
    Math.abs(location[1] - defaultCoord[1]) < COORD_TOLERANCE
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const regeocodeDistributors: PayloadHandler = async (req) => {
  const { payload } = req
  const user = req.user ?? await getUserFromRequest(req, payload)

  if (!user || !user.roles?.includes('admin')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url || '', 'http://localhost')
  const dryRun = url.searchParams.get('dryRun') === 'true'

  // Fetch all distributors
  const allDistributors = await payload.find({
    collection: 'distributors',
    limit: 2000,
    depth: 0,
  })

  // Find distributors with suspicious coordinates
  const suspicious = allDistributors.docs.filter((dist: any) => {
    if (!dist.location || !dist.region) return false
    return isSuspiciousCoordinate(dist.location as [number, number], dist.region)
  })

  if (suspicious.length === 0) {
    return Response.json({
      message: 'No distributors found with default/fallback coordinates',
      checked: allDistributors.docs.length,
      suspicious: 0,
      fixed: 0,
    })
  }

  // If dry run, just return the list
  if (dryRun) {
    return Response.json({
      message: 'Dry run - no changes made',
      checked: allDistributors.docs.length,
      suspicious: suspicious.length,
      distributors: suspicious.map((d: any) => {
        const addressParts = [d.address, d.city, d.state, d.zip].filter(Boolean)
        const fullAddress = addressParts.join(', ')
        return {
          id: d.id,
          name: d.name,
          address: d.address || '(missing)',
          city: d.city || '(missing)',
          state: d.state || '(missing)',
          zip: d.zip || '(missing)',
          region: d.region,
          fullAddress, // What will be geocoded
          currentLocation: d.location,
        }
      }),
    })
  }

  // Stream progress updates
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      let fixed = 0
      let failed = 0
      const results: any[] = []
      const total = suspicious.length

      send('progress', { current: 0, total, name: 'Starting...', percent: 0 })

      for (let i = 0; i < suspicious.length; i++) {
        const dist = suspicious[i] as any
        const percent = Math.round(((i + 1) / total) * 100)

        send('progress', { current: i + 1, total, name: dist.name, percent })

        // Build full address
        const addressParts = [dist.address, dist.city, dist.state, dist.zip].filter(Boolean)
        const fullAddress = addressParts.join(', ')

        // Geocode (tries Nominatim first, then Mapbox)
        let geocodeResult = await geocodeAddress(fullAddress)

        // If full address fails, try zip/city fallback
        if (!geocodeResult) {
          geocodeResult = await geocodeFallback(dist.city, dist.state, dist.zip)
        }

        if (geocodeResult) {
          const { coords, source } = geocodeResult
          // Verify the new coords aren't also default
          if (!isSuspiciousCoordinate(coords, dist.region)) {
            try {
              await payload.update({
                collection: 'distributors',
                id: dist.id,
                data: { location: coords },
              })

              const result = {
                id: dist.id,
                name: dist.name,
                address: fullAddress,
                oldLocation: dist.location,
                newLocation: coords,
                source,
                status: 'fixed',
              }
              results.push(result)
              send('item', { type: 'success', ...result })
              fixed++
            } catch (error: any) {
              const result = {
                id: dist.id,
                name: dist.name,
                address: fullAddress,
                error: error.message,
                status: 'error',
              }
              results.push(result)
              send('item', { type: 'error', ...result })
              failed++
            }
          } else {
            const result = {
              id: dist.id,
              name: dist.name,
              address: fullAddress,
              note: `Geocoded to same default location via ${source} - may need manual fix`,
              status: 'skipped',
            }
            results.push(result)
            send('item', { type: 'skip', ...result })
            failed++
          }
        } else {
          const result = {
            id: dist.id,
            name: dist.name,
            address: fullAddress,
            note: `Could not geocode: "${fullAddress}"`,
            status: 'failed',
          }
          results.push(result)
          send('item', { type: 'error', ...result })
          failed++
        }

        // Rate limit (Nominatim requires 1/sec, Mapbox is more lenient but let's be safe)
        await sleep(600)
      }

      send('complete', {
        checked: allDistributors.docs.length,
        suspicious: suspicious.length,
        fixed,
        failed,
        results,
      })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
