/**
 * Country helpers for distributors: ISO-3166-1 alpha-2 validation, the row's
 * effective country, and the key that groups rows for matching and duplicate checks.
 * English names for address text live in `lib/utils/country-names.ts`.
 *
 * A blank `country` means the United States, so rows saved before the field existed
 * keep their `region` (US state) group. `region` is US-only; non-US rows group by
 * country, because two-letter codes collide (`DE` Delaware/Germany, `CA` California/Canada).
 */

import { isStateCode } from './fields'

const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })

/**
 * Codes `Intl.DisplayNames` names that are not countries: placeholders, unions, and
 * ISO's exceptionally-reserved codes (islands, Sark). `XK` (Kosovo) is not ISO-assigned
 * but geocoders return it for real venues, so it stays valid.
 */
const NOT_COUNTRIES = new Set([
  'ZZ',
  'QO',
  'XA',
  'XB',
  'EU',
  'EZ',
  'UN',
  'AC',
  'CP',
  'DG',
  'EA',
  'IC',
  'TA',
  'CQ',
])

/** True for an uppercase two-letter code of a country (or Kosovo, `XK`). */
export function isCountryCode(value: string): boolean {
  if (!/^[A-Z]{2}$/.test(value) || NOT_COUNTRIES.has(value)) return false
  try {
    return names.of(value) !== undefined
  } catch {
    return false
  }
}

/**
 * The one rule for which country a row is in: its `country` when set; else `US` when
 * its state (or region) is a US code; else unknown (`undefined`), to be filled in from
 * the geocoder. The parser, the geocoder and the blank-filler all decide through this.
 */
export function effectiveCountry(row: {
  country?: string | null
  state?: string | null
  region?: string | null
}): string | undefined {
  const country = row.country?.trim()
  if (country) return country
  const state = row.state?.trim() || ''
  const region = row.region?.trim() || ''
  return isStateCode(state) || (!state && isStateCode(region)) ? 'US' : undefined
}

/**
 * Payload `where` clauses for the existing rows that could share a group with `rows`:
 * their US states by `region`, their other countries by `country`. Empty when no row
 * has a known group.
 */
export function groupWhere(
  rows: { country?: string | null; state?: string | null; region?: string | null }[],
): Record<string, { in: string[] }>[] {
  const regions = new Set<string>()
  const countries = new Set<string>()
  for (const row of rows) {
    if (row.region) regions.add(row.region)
    else {
      const country = effectiveCountry(row)
      if (country && country !== 'US') countries.add(country)
    }
  }
  return [
    ...(regions.size ? [{ region: { in: [...regions] } }] : []),
    ...(countries.size ? [{ country: { in: [...countries] } }] : []),
  ]
}

/** `US:<state>` for a blank or US country, else the country code. */
export function groupKey(row: { country?: string | null; region?: string | null }): string {
  const country = row.country || 'US'
  return country === 'US' ? `US:${row.region ?? ''}` : country
}
