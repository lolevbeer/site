/**
 * Parser for the distributor CSV upload on the admin Sync page.
 *
 * The format is documented in `public/distributor-csv-import.md`, which the
 * Sync page links to so it can be handed to an agent that normalizes raw data.
 * This parser validates and lightly cleans (ZIP+4, phone layout) but does not
 * guess: anything that needs judgment, such as lowercase state codes or license
 * numbers in names, is rejected so the normalizer fixes it at the source.
 *
 * Only `name` and `address` are required. A row is a US row when its `country` is
 * `US`, or the country is blank and the state (or region) is a US code; US rows keep
 * every US rule (state code, ZIP, phone layout, `region` defaulting to the state).
 * Any other row is a non-US venue, or one whose country the importer fills in from
 * the geocoder: `state`, `zip` and `phone` are free text and `region` is empty.
 * `city`, `state` and `country` may be blank; the import endpoint fills blanks and
 * never overwrites a cell supplied here.
 */
import { parseCSVLine } from '@/src/utils/csv'
import { groupKey, isCountryCode } from './country'
import {
  CUSTOMER_TYPES,
  isCustomerType,
  isStateCode,
  type CustomerType,
  type StateCode,
} from './fields'

export interface DistributorCsvRow {
  /** 1-based line in the file, for error messages. */
  line: number
  name: string
  address: string
  /** Unset when the cell is blank, so the importer can fill it from the geocoder. */
  city?: string
  /** A US code for US rows; free text otherwise. Unset when blank. */
  state?: string
  /** ISO-3166-1 alpha-2, uppercase. Unset when blank (US, or to be filled in). */
  country?: string
  /** US ZIP (five digits) for US rows; free text otherwise. */
  zip: string
  phone: string
  /** US rows only; defaults to `state` when the column or cell is blank. */
  region?: StateCode
  /** The three below are unset when the cell is blank, so a re-import never overwrites with a guess. */
  website?: string
  customerType?: CustomerType
  active?: boolean
}

export interface DistributorCsvError {
  line: number
  message: string
}

const REQUIRED = ['name', 'address'] as const

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  const ten = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits
  if (ten.length === 10) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
  return raw
}

const notAState = (column: string, value: string, hint = '') =>
  `${column} "${value}" is not a two-letter US state code (uppercase)${hint}`

/** A two-letter state with no country is ambiguous (`QC`, `DE`, `CA`), so ask for the country. */
const NEEDS_COUNTRY = '; for a non-US venue, fill the country column'

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
  const stateCell = get('state')
  const regionCell = get('region')
  const countryCell = get('country')
  if (countryCell && !isCountryCode(countryCell)) {
    return {
      error: `country "${countryCell}" must be an uppercase two-letter ISO code, e.g. NL, JP, GB`,
    }
  }

  const isUS =
    countryCell === 'US' ||
    (!countryCell && (isStateCode(stateCell) || (!stateCell && isStateCode(regionCell))))
  const zipCell = get('zip')
  let region: StateCode | undefined
  let zip = zipCell
  let phone = get('phone')

  if (isUS) {
    if (stateCell && !isStateCode(stateCell)) return { error: notAState('state', stateCell) }
    if (regionCell && !isStateCode(regionCell)) return { error: notAState('region', regionCell) }
    region = (regionCell || stateCell || undefined) as StateCode | undefined
    if (zipCell && !/^\d{5}(-\d{4})?$/.test(zipCell)) {
      return { error: `zip "${zipCell}" must be 5 digits or ZIP+4` }
    }
    zip = zipCell.slice(0, 5)
    phone = formatPhone(phone)
  } else {
    if (!countryCell && /^[A-Za-z]{2}$/.test(stateCell)) {
      return { error: notAState('state', stateCell, NEEDS_COUNTRY) }
    }
    if (regionCell) {
      return {
        error: countryCell
          ? `region "${regionCell}" applies to US venues only; leave it blank for ${countryCell}`
          : notAState('region', regionCell),
      }
    }
  }

  const customerTypeCell = get('customertype')
  const customerType = isCustomerType(customerTypeCell) ? customerTypeCell : undefined
  if (customerTypeCell && !customerType) {
    const allowed = CUSTOMER_TYPES.map((t) => t.value).join(', ')
    return { error: `customerType "${customerTypeCell}" must be one of: ${allowed}` }
  }

  const website = get('website')
  if (website && !/^https?:\/\//i.test(website)) {
    return { error: `website "${website}" must start with http:// or https://` }
  }

  const activeCell = get('active').toLowerCase()
  if (activeCell && activeCell !== 'true' && activeCell !== 'false') {
    return { error: `active "${get('active')}" must be true or false` }
  }

  const row: DistributorCsvRow = { line, name, address, zip, phone }
  if (city) row.city = city
  if (stateCell) row.state = stateCell
  if (countryCell) row.country = countryCell
  if (region) row.region = region
  if (website) row.website = website
  if (customerType) row.customerType = customerType
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
  const columnIndex = new Map(header.map((h, i) => [h, i]))

  for (let i = first + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const cells = parseCSVLine(lines[i])
    const get = (column: string) => {
      const index = columnIndex.get(column)
      return index === undefined ? '' : (cells[index] ?? '').trim()
    }

    const result = parseRow(i + 1, get)
    if ('error' in result) {
      errors.push({ line: i + 1, message: result.error })
      continue
    }

    // Rows in a known group (US state or country) are the same venue by name; rows
    // with no known group yet can only be compared by name and street address.
    const group = result.region || (result.country !== 'US' && result.country) || undefined
    const key = group ? `${groupKey(result)}|${result.name}` : `?|${result.name}|${result.address}`
    const earlier = seen.get(key)
    if (earlier !== undefined) {
      errors.push({
        line: i + 1,
        message: `duplicate of line ${earlier}: "${result.name}" already appears ${
          group ? `in ${group}` : 'at the same address'
        }`,
      })
      continue
    }
    seen.set(key, i + 1)
    rows.push(result)
  }

  return { rows, errors }
}
