import type { PayloadHandler } from 'payload'
import { getUserFromRequest } from './auth-helper'
import { geocode } from './geocode'
import { parseCSVLine } from '@/src/utils/csv'
import { sleep } from '@/src/utils/async'
import { createSSEResponse } from '@/src/utils/sse-response'
import { DEFAULT_REGION_COORDS } from '@/src/utils/distributor-region-coords'

interface ParsedRow {
  name: string
  address: string
  city: string
  state: string
  zip: string
  phone: string
}

/**
 * Map the Lake Beverage export's columns onto distributor rows.
 *
 * Field-level trimming happens here rather than in the shared
 * {@link parseCSVLine}, which returns fields verbatim.
 */
function parseCSV(text: string): ParsedRow[] {
  const lines = text
    .trim()
    .split('\n')
    .filter((line) => line.trim())
  if (lines.length < 2) return []

  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length < 6) continue

    const name = values[0]?.trim()
    const address = values[1]?.trim()
    const city = values[2]?.trim()
    const state = values[4]?.trim()
    let zip = values[5]?.trim()
    const phone = values[6]?.trim() || ''

    if (!name || !address || !city) continue
    if (name.toLowerCase().includes('lake beverage')) continue

    if (zip && zip.length > 5) zip = zip.substring(0, 5)
    if (zip && !/^\d{5}$/.test(zip)) zip = ''

    rows.push({ name, address, city, state: state || 'NY', zip, phone })
  }

  return rows
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

// Lake Beverage is the Rochester, NY distributor, so ungeocodable addresses
// land on the shared NY fallback point.
const DEFAULT_COORDS: [number, number] = DEFAULT_REGION_COORDS.NY

export const importLakeBeverageCSV: PayloadHandler = async (req) => {
  const { payload } = req
  const user = req.user ?? (await getUserFromRequest(req, payload))

  if (!user || !user.roles?.includes('admin')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData?.()
    if (!formData) {
      return Response.json({ error: 'No form data' }, { status: 400 })
    }

    const file = formData.get('file') as File | null
    if (!file) {
      return Response.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const text = await file.text()
    const rows = parseCSV(text)

    if (rows.length === 0) {
      return Response.json({ error: 'No valid rows found in CSV' }, { status: 400 })
    }

    // Use streaming response for progress
    return createSSEResponse(async (send) => {
      send('status', { message: `Starting import of ${rows.length} distributors...` })

      let imported = 0,
        skipped = 0,
        errors = 0
      const details: string[] = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]

        send('progress', {
          current: i + 1,
          total: rows.length,
          name: row.name,
          percent: Math.round(((i + 1) / rows.length) * 100),
        })

        // Check for existing
        const existing = await payload.find({
          collection: 'distributors',
          where: { name: { equals: row.name } },
          limit: 1,
        })

        if (existing.docs.length > 0) {
          details.push(`Skipped: "${row.name}" already exists`)
          send('item', { name: row.name, action: 'skipped', reason: 'already exists' })
          skipped++
          continue
        }

        // Geocode
        const fullAddress = `${row.address}, ${row.city}, ${row.state} ${row.zip}`.trim()
        const coords = await geocode(fullAddress)
        const location = coords || DEFAULT_COORDS

        if (!coords) {
          details.push(`Warning: Could not geocode "${row.name}"`)
        }

        try {
          await payload.create({
            collection: 'distributors',
            data: {
              name: row.name,
              address: row.address,
              city: row.city,
              state: row.state,
              zip: row.zip,
              phone: row.phone ? formatPhone(row.phone) : undefined,
              customerType: 'Retail',
              region: 'NY',
              location,
              active: true,
            },
          })
          details.push(`Imported: ${row.name}`)
          send('item', { name: row.name, action: 'imported', geocoded: !!coords })
          imported++
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          details.push(`Error: "${row.name}" - ${message}`)
          send('item', { name: row.name, action: 'error', error: message })
          errors++
        }

        // Rate limit for Nominatim
        await sleep(1100)
      }

      send('complete', {
        success: true,
        imported,
        skipped,
        errors,
        details,
      })
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Import failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
