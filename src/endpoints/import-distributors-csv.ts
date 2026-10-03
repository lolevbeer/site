/**
 * Admin upload endpoint for the distributor CSV format documented in
 * `public/distributor-csv-import.md`. Works for any US state or DC:
 * each row's `region` (default: its `state`) decides where it is stored.
 *
 * Rows are matched to existing distributors by exact name within their region,
 * so re-uploading a file updates rather than duplicates. Latitude/longitude are
 * never in the file; they are geocoded here. A row that cannot be geocoded is
 * reported and not created, because `location` is required and a made-up
 * fallback pin would be mistaken for a real one by the re-geocoding repair pass.
 */
import type { PayloadHandler } from 'payload'
import type { Distributor } from '@/src/payload-types'
import { getUserFromRequest } from './auth-helper'
import { isAdmin } from '@/src/access/roles'
import { geocode } from './geocode'
import { createSSEResponse } from '@/src/utils/sse-response'
import {
  distributorImportPatch,
  formatFullAddress,
  indexDocsByName,
} from '@/lib/distributors/import-patch'
import { applyExistingDistributorPatch } from '@/lib/distributors/upsert-existing'
import { parseDistributorsCsv } from '@/lib/distributors/parse-distributors-csv'

export const importDistributorsCsv: PayloadHandler = async (req) => {
  const { payload } = req
  const user = req.user ?? (await getUserFromRequest(req, payload))

  if (!user || !isAdmin(user)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData?.()
  const file = formData?.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'No file uploaded' }, { status: 400 })
  }

  const { rows, errors: parseErrors } = parseDistributorsCsv(await file.text())
  if (rows.length === 0) {
    const details = parseErrors.map((e) => `Line ${e.line}: ${e.message}`)
    return Response.json(
      {
        error: details[0] ?? 'No rows found in CSV',
        details,
        imported: 0,
        skipped: 0,
        errors: Math.max(parseErrors.length, 1),
      },
      { status: 400 },
    )
  }

  return createSSEResponse(async (send) => {
    let imported = 0
    let updated = 0
    let skipped = 0
    let errors = parseErrors.length
    const details = parseErrors.map((e) => `Error: Line ${e.line}: ${e.message}`)
    for (const message of details) send('item', { type: 'error', message })

    const regions = [...new Set(rows.map((r) => r.region))]
    const existing = await payload.find({
      collection: 'distributors',
      where: { region: { in: regions } },
      pagination: false,
      depth: 0,
      overrideAccess: false,
      user,
    })
    const byRegion = new Map<string, Map<string, Distributor[]>>()
    for (const region of regions) {
      byRegion.set(region, indexDocsByName(existing.docs.filter((d) => d.region === region)))
    }

    const report = (type: 'success' | 'skip' | 'error', message: string) => {
      details.push(message)
      send('item', { type, message })
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      send('progress', {
        current: i + 1,
        total: rows.length,
        name: row.name,
        percent: Math.round(((i + 1) / rows.length) * 100),
      })

      // The parser already rejects a repeated name within a region, so this
      // index never needs updating as rows are created or patched.
      const matches = byRegion.get(row.region)!.get(row.name) ?? []
      if (matches.length > 1) {
        report(
          'error',
          `Error: "${row.name}" matches ${matches.length} existing rows in ${row.region}; skipped`,
        )
        errors++
        continue
      }

      // Everything but the line number and name is a distributor field
      const { line, name, ...fields } = row

      try {
        if (matches.length === 1) {
          const current = matches[0]
          const patch = distributorImportPatch(current, fields)
          if (!patch) {
            skipped++
            continue
          }
          const result = await applyExistingDistributorPatch({
            payload,
            user,
            current,
            patch,
            name,
            geocode,
          })
          report('success', `Updated: "${row.name}" (${Object.keys(patch).join(', ')})`)
          if (result.warning) details.push(result.warning)
          updated++
          continue
        }

        const location = await geocode(formatFullAddress(row))
        if (!location) {
          report('error', `Error: Could not geocode "${name}" (line ${line}); not created`)
          errors++
          continue
        }

        await payload.create({
          collection: 'distributors',
          data: { ...fields, name, location, active: fields.active ?? true },
          overrideAccess: false,
          user,
        })
        report('success', `Imported: ${row.name}`)
        imported++
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        report('error', `Error: Failed to import "${row.name}" - ${message}`)
        errors++
      }
    }

    if (skipped > 0) report('skip', `Skipped ${skipped} unchanged`)

    send('complete', { imported, updated, skipped, errors, details })
  })
}
