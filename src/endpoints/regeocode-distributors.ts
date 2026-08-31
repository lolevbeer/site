import type { PayloadHandler } from 'payload'
import type { Distributor } from '@/src/payload-types'
import { getUserFromRequest } from './auth-helper'
import { geocodeAddress, geocodeFallback } from './geocode'
import { sleep } from '@/src/utils/async'
import { createSSEResponse } from '@/src/utils/sse-response'
import { DEFAULT_REGION_COORDS } from '@/src/utils/distributor-region-coords'

// Default coordinates used as fallbacks during import — the same table the
// importers write, so a record parked on a fallback point is detectable here
const DEFAULT_COORDS = DEFAULT_REGION_COORDS

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

export const regeocodeDistributors: PayloadHandler = async (req) => {
  const { payload } = req
  const user = req.user ?? (await getUserFromRequest(req, payload))

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
  const suspicious = allDistributors.docs.filter((dist) => {
    if (!dist.location || !dist.region) return false
    return isSuspiciousCoordinate(dist.location, dist.region)
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
      distributors: suspicious.map((d) => {
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
  return createSSEResponse(async (send) => {
    let fixed = 0
    let failed = 0
    const results: Record<string, unknown>[] = []
    const total = suspicious.length

    send('progress', { current: 0, total, name: 'Starting...', percent: 0 })

    for (let i = 0; i < suspicious.length; i++) {
      const dist = suspicious[i] as Distributor
      const percent = Math.round(((i + 1) / total) * 100)

      send('progress', { current: i + 1, total, name: dist.name, percent })

      // Build full address
      const addressParts = [dist.address, dist.city, dist.state, dist.zip].filter(Boolean)
      const fullAddress = addressParts.join(', ')

      // Geocode (tries Nominatim first, then Geocodio and Bing)
      let geocodeResult = await geocodeAddress(fullAddress)

      // If full address fails, try zip/city fallback
      if (!geocodeResult) {
        geocodeResult = await geocodeFallback(dist.city ?? '', dist.state ?? '', dist.zip ?? '')
      }

      if (geocodeResult) {
        const { coords, source } = geocodeResult
        // Verify the new coords aren't also default
        if (!isSuspiciousCoordinate(coords, dist.region ?? '')) {
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
          } catch (error: unknown) {
            const result = {
              id: dist.id,
              name: dist.name,
              address: fullAddress,
              error: error instanceof Error ? error.message : 'Unknown error',
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

      // Rate limit requests to stay within Nominatim's usage limits
      await sleep(600)
    }

    send('complete', {
      checked: allDistributors.docs.length,
      suspicious: suspicious.length,
      fixed,
      failed,
      results,
    })
  })
}
