/**
 * Country helpers for distributors: ISO-3166-1 alpha-2 validation, English display
 * names, and the key that groups rows for matching and duplicate checks.
 *
 * A blank `country` means the United States, so rows saved before the field existed
 * keep their `region` (US state) group. `region` is US-only; non-US rows group by
 * country, because two-letter codes collide (`DE` Delaware/Germany, `CA` California/Canada).
 */

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

/** English country name for a valid code, e.g. `NL` becomes `Netherlands`. */
export function countryName(code: string): string {
  return names.of(code) ?? code
}

/** `US:<state>` for a blank or US country, else the country code. */
export function groupKey(row: { country?: string | null; region?: string | null }): string {
  const country = row.country || 'US'
  return country === 'US' ? `US:${row.region ?? ''}` : country
}
