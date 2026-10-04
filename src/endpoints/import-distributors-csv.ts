/**
 * Admin upload endpoint for the distributor CSV format documented in
 * `public/distributor-csv-import.md`. Works for US and international venues.
 *
 * 1. Parse. US rows (country `US`, or blank with a US state) keep the US rules;
 *    other rows may leave city, state and country blank.
 * 2. Enrich. A row missing city, state or country is located with
 *    `resolveDistributor` (Mapbox, Nominatim, Geocodio for US), and only its blank
 *    cells are filled from the answer; a cell the CSV supplied is never changed.
 *    A row with latitude/longitude keeps that pin and is only reverse-looked-up
 *    (`reverseDistributor`) to fill blanks; if that finds nothing it still imports.
 *    A row that cannot be located is reported and not created, because `location`
 *    is required and a made-up pin would be mistaken for a real one.
 * 3. Match. Rows are matched to existing distributors by exact name within their
 *    group: the US state (`region`) for US rows, the country for the rest, so
 *    re-uploading a file updates rather than duplicates.
 *
 * `dryRun=true` runs steps 1–3 and reports what would happen without writing. Every
 * line names the resolved address and which cells were inferred; an uncertain
 * geocode is marked "check this" so a wrong match is caught before it is saved.
 */
import type { PayloadHandler, Where } from 'payload'
import type { Distributor } from '@/src/payload-types'
import { getUserFromRequest } from './auth-helper'
import { isAdmin } from '@/src/access/roles'
import { geocodeDistributor, resolveDistributor, reverseDistributor } from './geocode'
import { createSSEResponse } from '@/src/utils/sse-response'
import { distributorImportPatch, indexDocsByName } from '@/lib/distributors/import-patch'
import { applyExistingDistributorPatch } from '@/lib/distributors/upsert-existing'
import {
  parseDistributorsCsv,
  type DistributorCsvRow,
} from '@/lib/distributors/parse-distributors-csv'
import { fillBlankParts } from '@/lib/distributors/fill-blank-parts'
import { groupKey } from '@/lib/distributors/country'
import { formatAddress } from '@/lib/utils/formatters'

/** A parsed row after enrichment, with the pin it was located at (if it was). */
type EnrichedRow = DistributorCsvRow & {
  location?: [number, number]
  /** e.g. ` (inferred: city, country; check this)`, appended to report lines. */
  note: string
}

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
  const dryRun = formData?.get('dryRun') === 'true'

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

    const report = (type: 'success' | 'skip' | 'error', message: string) => {
      details.push(message)
      send('item', { type, message })
    }
    const progress = (i: number, total: number, name: string, phase: string) =>
      send('progress', {
        current: i + 1,
        total,
        name: `${phase}: ${name}`,
        percent: Math.round(((i + 1) / total) * 100),
      })

    // ---- 2. Enrich: locate rows missing city, state or country --------------------
    const enriched: EnrichedRow[] = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row.city && row.state && (row.country || row.region)) {
        enriched.push({ ...row, note: '' })
        continue
      }
      progress(i, rows.length, row.name, 'Locating')
      if (row.location) {
        // The file gave the pin: keep it, and only look up the blank parts
        const around = await reverseDistributor(row.location)
        const { filled, inferred } = around
          ? fillBlankParts(row, around.parts)
          : { filled: {}, inferred: [] }
        enriched.push({
          ...row,
          ...filled,
          note: inferred.length ? ` (inferred: ${inferred.join(', ')})` : '',
        })
        continue
      }
      const resolved = await resolveDistributor(row)
      if (!resolved) {
        report('error', `Error: Could not geocode "${row.name}" (line ${row.line}); not created`)
        errors++
        continue
      }
      const { filled, inferred } = fillBlankParts(row, resolved.parts)
      const flags = [
        inferred.length ? `inferred: ${inferred.join(', ')}` : '',
        resolved.uncertain ? 'check this' : '',
      ].filter(Boolean)
      enriched.push({
        ...row,
        ...filled,
        location: resolved.coords,
        note: flags.length ? ` (${flags.join('; ')})` : '',
      })
    }

    // Groups are final only now, so recheck names the parser could not compare.
    const seen = new Map<string, number>()
    const ready: EnrichedRow[] = []
    for (const row of enriched) {
      const key = `${groupKey(row)}|${row.name}`
      const earlier = seen.get(key)
      if (earlier !== undefined) {
        report('error', `Error: Line ${row.line}: duplicate of line ${earlier}: "${row.name}"`)
        errors++
        continue
      }
      seen.set(key, row.line)
      ready.push(row)
    }

    // ---- 3. Match existing rows by name within each group -------------------------
    const regions = [...new Set(ready.flatMap((r) => (r.region ? [r.region] : [])))]
    const countries = [
      ...new Set(ready.flatMap((r) => (!r.region && r.country ? [r.country] : []))),
    ]
    const or: Where[] = [
      ...(regions.length ? [{ region: { in: regions } }] : []),
      ...(countries.length ? [{ country: { in: countries } }] : []),
    ]
    const existing = or.length
      ? await payload.find({
          collection: 'distributors',
          where: { or },
          pagination: false,
          depth: 0,
          overrideAccess: false,
          user,
        })
      : { docs: [] as Distributor[] }
    const byGroup = new Map<string, Map<string, Distributor[]>>()
    for (const key of new Set(existing.docs.map((d) => groupKey(d)))) {
      byGroup.set(key, indexDocsByName(existing.docs.filter((d) => groupKey(d) === key)))
    }

    for (let i = 0; i < ready.length; i++) {
      const row = ready[i]
      progress(i, ready.length, row.name, dryRun ? 'Checking' : 'Saving')
      const matches = byGroup.get(groupKey(row))?.get(row.name) ?? []
      if (matches.length > 1) {
        report(
          'error',
          `Error: "${row.name}" matches ${matches.length} existing rows in ${row.region ?? row.country}; skipped`,
        )
        errors++
        continue
      }

      // Everything but bookkeeping is a distributor field
      const { line, name, location, note, ...fields } = row
      const at = `${formatAddress(row)}${note}`

      try {
        if (matches.length === 1) {
          const current = matches[0]
          const patch = distributorImportPatch(current, fields)
          if (!patch) {
            skipped++
            continue
          }
          const changed = Object.keys(patch).join(', ')
          if (dryRun) {
            report('success', `Would update: "${name}" (${changed}) — ${at}`)
            updated++
            continue
          }
          const result = await applyExistingDistributorPatch({
            payload,
            user,
            current,
            patch,
            name,
            // Reuse the pin found while enriching instead of geocoding twice
            geocode: location ? async () => location : geocodeDistributor,
          })
          report('success', `Updated: "${name}" (${changed}) — ${at}`)
          if (result.warning) details.push(result.warning)
          updated++
          continue
        }

        if (dryRun) {
          report('success', `Would import: ${name} — ${at}`)
          imported++
          continue
        }

        const pin = location ?? (await geocodeDistributor(row))
        if (!pin) {
          report('error', `Error: Could not geocode "${name}" (line ${line}); not created`)
          errors++
          continue
        }

        await payload.create({
          collection: 'distributors',
          data: { ...fields, name, location: pin, active: fields.active ?? true },
          overrideAccess: false,
          user,
        })
        report('success', `Imported: ${name} — ${at}`)
        imported++
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        report('error', `Error: Failed to import "${name}" - ${message}`)
        errors++
      }
    }

    if (skipped > 0) report('skip', `${dryRun ? 'Would skip' : 'Skipped'} ${skipped} unchanged`)

    send('complete', { imported, updated, skipped, errors, details, dryRun })
  })
}
