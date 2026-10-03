/**
 * Parser for the distributor CSV upload on the admin Sync page.
 *
 * The format is documented in `public/distributor-csv-import.md`, which the
 * Sync page links to so it can be handed to an agent that normalizes raw data.
 * This parser validates and lightly cleans (ZIP+4, phone layout) but does not
 * guess: anything that needs judgment, such as lowercase state codes or license
 * numbers in names, is rejected so the normalizer fixes it at the source.
 */
import { parseCSVLine } from '@/src/utils/csv'
import { isStateCode, type StateCode } from './states'

export const CUSTOMER_TYPES = ['Retail', 'On Premise', 'Home-D'] as const
export type CustomerType = (typeof CUSTOMER_TYPES)[number]

export interface DistributorCsvRow {
  /** 1-based line in the file, for error messages. */
  line: number
  name: string
  address: string
  city: string
  state: StateCode
  zip: string
  phone: string
  /** Defaults to `state` when the column or cell is blank. */
  region: StateCode
  /** The three below are unset when the cell is blank, so a re-import never overwrites with a guess. */
  website?: string
  customerType?: CustomerType
  active?: boolean
}

export interface DistributorCsvError {
  line: number
  message: string
}

const REQUIRED = ['name', 'address', 'city', 'state'] as const

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  const ten = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits
  if (ten.length === 10) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
  return raw
}

/** Validate one row; returns the first problem found, or the cleaned row. */
function parseRow(
  line: number,
  get: (column: string) => string,
): DistributorCsvRow | { error: string } {
  const name = get('name')
  if (!name) return { error: 'name is required' }
  const address = get('address')
  if (!address) return { error: 'address is required' }
  const city = get('city')
  if (!city) return { error: 'city is required' }

  const state = get('state')
  if (!isStateCode(state)) {
    return { error: `state "${state}" is not a two-letter US state code (uppercase)` }
  }
  const regionCell = get('region')
  if (regionCell && !isStateCode(regionCell)) {
    return { error: `region "${regionCell}" is not a two-letter US state code (uppercase)` }
  }

  const zipCell = get('zip')
  if (zipCell && !/^\d{5}(-\d{4})?$/.test(zipCell)) {
    return { error: `zip "${zipCell}" must be 5 digits or ZIP+4` }
  }

  const typeCell = get('customertype')
  if (typeCell && !(CUSTOMER_TYPES as readonly string[]).includes(typeCell)) {
    return { error: `customerType "${typeCell}" must be one of: ${CUSTOMER_TYPES.join(', ')}` }
  }

  const website = get('website')
  if (website && !/^https?:\/\//i.test(website)) {
    return { error: `website "${website}" must start with http:// or https://` }
  }

  const activeCell = get('active').toLowerCase()
  if (activeCell && activeCell !== 'true' && activeCell !== 'false') {
    return { error: `active "${get('active')}" must be true or false` }
  }

  const row: DistributorCsvRow = {
    line,
    name,
    address,
    city,
    state,
    zip: zipCell.slice(0, 5),
    phone: formatPhone(get('phone')),
    region: (regionCell || state) as StateCode,
  }
  if (website) row.website = website
  if (typeCell) row.customerType = typeCell as CustomerType
  if (activeCell) row.active = activeCell === 'true'
  return row
}

/**
 * Parse CSV text into valid rows plus per-line errors.
 *
 * Header problems (empty file, missing required column) are reported on line 1
 * and yield no rows. Row problems are reported with the row's file line and do
 * not stop the other rows. Quoted fields may not span lines.
 */
export function parseDistributorsCsv(text: string): {
  rows: DistributorCsvRow[]
  errors: DistributorCsvError[]
} {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  const first = lines.findIndex((l) => l.trim())
  if (first === -1) return { rows: [], errors: [{ line: 1, message: 'file is empty' }] }

  const header = parseCSVLine(lines[first]).map((h) => h.trim().toLowerCase())
  const missing = REQUIRED.filter((c) => !header.includes(c))
  if (missing.length) {
    return {
      rows: [],
      errors: [{ line: first + 1, message: `missing required column(s): ${missing.join(', ')}` }],
    }
  }

  const rows: DistributorCsvRow[] = []
  const errors: DistributorCsvError[] = []
  const seen = new Map<string, number>()

  for (let i = first + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const cells = parseCSVLine(lines[i])
    const get = (column: string) => {
      const index = header.indexOf(column)
      return index === -1 ? '' : (cells[index] ?? '').trim()
    }

    const result = parseRow(i + 1, get)
    if ('error' in result) {
      errors.push({ line: i + 1, message: result.error })
      continue
    }

    const key = `${result.region}|${result.name}`
    const earlier = seen.get(key)
    if (earlier !== undefined) {
      errors.push({
        line: i + 1,
        message: `duplicate of line ${earlier}: "${result.name}" already appears in ${result.region}`,
      })
      continue
    }
    seen.set(key, i + 1)
    rows.push(result)
  }

  return { rows, errors }
}
